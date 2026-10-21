import { and, eq, gt, isNull, lt, lte, sql } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import {
  cleaningCycles,
  cleaningEvents,
  pushDeliveries,
  pushSubscriptions,
} from "../../db/schema.js";
import { hashToken } from "../../domain/cleaning.js";
import type { Bathroom } from "../../domain/reports.js";
import {
  allowedPushEndpoint,
  decryptSubscription,
  encryptSubscription,
  PushRequestError,
  type PushSubscriptionData,
} from "../../lib/push-security.js";
export type PushPayload = {
  type: "cleaning-started";
  cycleId: string;
  building: string;
  floor: string;
  category: string;
  issuedAt: string;
  expectedEndAt: string;
};
export type PushSender = (
  subscription: PushSubscriptionData,
  payload: PushPayload,
  ttl: number,
) => Promise<void>;
export function createPushRepository(db: Database, encryptionKey = "") {
  return {
    async save(
      owner: string,
      bathroom: Bathroom,
      subscription: PushSubscriptionData,
      at = new Date(),
    ) {
      if (
        bathroom.building !== "HH5" ||
        !allowedPushEndpoint(subscription.endpoint)
      )
        throw new PushRequestError(400);
      const ownerHash = hashToken(owner);
      const endpointHash = hashToken(subscription.endpoint);
      return db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`push-owner:${ownerHash}`}))`,
        );
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`push-endpoint:${endpointHash}`}))`,
        );
        const claimed = await tx.query.pushSubscriptions.findFirst({
          where: eq(pushSubscriptions.endpointHash, endpointHash),
        });
        if (claimed && claimed.ownerHash !== ownerHash)
          throw new PushRequestError(409);
        const previous = await tx.query.pushSubscriptions.findFirst({
          where: eq(pushSubscriptions.ownerHash, ownerHash),
        });
        const changed =
          !previous ||
          previous.endpointHash !== endpointHash ||
          previous.building !== bathroom.building ||
          previous.floor !== bathroom.floor ||
          previous.category !== bathroom.category;
        const value = {
          ownerHash,
          endpointHash,
          encrypted: encryptSubscription(subscription, encryptionKey),
          ...bathroom,
          changedAt: changed ? at : previous.changedAt,
          expiresAt: new Date(at.getTime() + 30 * 86_400_000),
        };
        await tx
          .insert(pushSubscriptions)
          .values({ ...value, createdAt: at })
          .onConflictDoUpdate({
            target: pushSubscriptions.ownerHash,
            set: value,
          });
      });
    },
    async preference(owner: string, now = new Date()) {
      const row = await db.query.pushSubscriptions.findFirst({
        where: and(
          eq(pushSubscriptions.ownerHash, hashToken(owner)),
          gt(pushSubscriptions.expiresAt, now),
        ),
      });
      return row
        ? {
            building: "HH5" as const,
            floor: row.floor as Bathroom["floor"],
            category: row.category,
          }
        : null;
    },
    async remove(owner: string) {
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.ownerHash, hashToken(owner)));
    },
    async drain(send: PushSender, at?: Date) {
      const now =
        at ??
        new Date(
          (
            await db.execute<{ now: string }>(
              sql`select clock_timestamp() as now`,
            )
          ).rows[0]!.now,
        );
      await db.transaction(async (tx) => {
        await tx
          .update(cleaningEvents)
          .set({ processedAt: now })
          .where(
            and(
              isNull(cleaningEvents.processedAt),
              lte(cleaningEvents.createdAt, new Date(now.getTime() - 60_000)),
            ),
          );
        const events = await tx
          .select()
          .from(cleaningEvents)
          .where(isNull(cleaningEvents.processedAt))
          .limit(20)
          .for("update", { skipLocked: true });
        for (const event of events) {
          const cycle = await tx.query.cleaningCycles.findFirst({
            where: eq(cleaningCycles.id, event.cycleId),
          });
          if (
            cycle &&
            !cycle.endedAt &&
            cycle.expectedEndAt > now &&
            event.createdAt.getTime() + 60_000 > now.getTime()
          ) {
            const subscriptions = await tx
              .select({ id: pushSubscriptions.id })
              .from(pushSubscriptions)
              .where(
                and(
                  eq(pushSubscriptions.building, cycle.building),
                  eq(pushSubscriptions.floor, cycle.floor),
                  eq(pushSubscriptions.category, cycle.category),
                  gt(pushSubscriptions.expiresAt, now),
                  lte(pushSubscriptions.createdAt, event.createdAt),
                  lte(pushSubscriptions.changedAt, event.createdAt),
                ),
              );
            if (subscriptions.length)
              await tx
                .insert(pushDeliveries)
                .values(
                  subscriptions.map((subscription) => ({
                    cycleId: event.cycleId,
                    subscriptionId: subscription.id,
                    nextAttemptAt: now,
                  })),
                )
                .onConflictDoNothing();
          }
          await tx
            .update(cleaningEvents)
            .set({ processedAt: now })
            .where(eq(cleaningEvents.cycleId, event.cycleId));
        }
      });
      const totals = { sent: 0, discarded: 0, retried: 0 };
      for (let i = 0; i < 20; i++) {
        const outcome = await db.transaction(async (tx) => {
          const now =
            at ??
            new Date(
              (
                await tx.execute<{ now: string }>(
                  sql`select clock_timestamp() as now`,
                )
              ).rows[0]!.now,
            );
          const [delivery] = await tx
            .select()
            .from(pushDeliveries)
            .where(
              and(
                isNull(pushDeliveries.sentAt),
                isNull(pushDeliveries.discardedAt),
                lt(pushDeliveries.attempts, 3),
                lte(pushDeliveries.nextAttemptAt, now),
              ),
            )
            .limit(1)
            .for("update", { skipLocked: true });
          if (!delivery) return null;
          const identity = and(
            eq(pushDeliveries.cycleId, delivery.cycleId),
            eq(pushDeliveries.subscriptionId, delivery.subscriptionId),
          );
          const event = await tx.query.cleaningEvents.findFirst({
            where: eq(cleaningEvents.cycleId, delivery.cycleId),
          });
          const cycle = await tx.query.cleaningCycles.findFirst({
            where: eq(cleaningCycles.id, delivery.cycleId),
          });
          const subscription = await tx.query.pushSubscriptions.findFirst({
            where: eq(pushSubscriptions.id, delivery.subscriptionId),
          });
          if (
            !event ||
            !cycle ||
            cycle.endedAt ||
            cycle.expectedEndAt <= now ||
            event.createdAt.getTime() + 60_000 <= now.getTime() ||
            !subscription ||
            subscription.expiresAt <= now ||
            subscription.changedAt > event.createdAt ||
            subscription.building !== cycle.building ||
            subscription.floor !== cycle.floor ||
            subscription.category !== cycle.category
          ) {
            await tx
              .update(pushDeliveries)
              .set({ discardedAt: now })
              .where(identity);
            return "discarded" as const;
          }
          try {
            const value = decryptSubscription(
              subscription.encrypted,
              encryptionKey,
            );
            if (!allowedPushEndpoint(value.endpoint))
              throw new Error("Disallowed push service");
            await send(
              value,
              {
                type: "cleaning-started",
                cycleId: cycle.id,
                building: cycle.building,
                floor: cycle.floor,
                category: cycle.category,
                issuedAt: event.createdAt.toISOString(),
                expectedEndAt: cycle.expectedEndAt.toISOString(),
              },
              Math.max(
                1,
                Math.min(
                  60,
                  Math.floor(
                    (cycle.expectedEndAt.getTime() - now.getTime()) / 1000,
                  ),
                ),
              ),
            );
            await tx
              .update(pushDeliveries)
              .set({ sentAt: now, attempts: delivery.attempts + 1 })
              .where(identity);
            return "sent" as const;
          } catch (error) {
            const status =
              typeof error === "object" &&
              error !== null &&
              "statusCode" in error
                ? error.statusCode
                : 0;
            if (status === 404 || status === 410) {
              await tx
                .delete(pushSubscriptions)
                .where(eq(pushSubscriptions.id, subscription.id));
              return "discarded" as const;
            }
            const attempts = delivery.attempts + 1;
            await tx
              .update(pushDeliveries)
              .set({
                attempts,
                nextAttemptAt: new Date(
                  now.getTime() + 5_000 * 2 ** (attempts - 1),
                ),
                ...(attempts >= 3 ? { discardedAt: now } : {}),
              })
              .where(identity);
            return attempts >= 3
              ? ("discarded" as const)
              : ("retried" as const);
          }
        });
        if (!outcome) break;
        totals[outcome]++;
      }
      return totals;
    },
  };
}
export type PushRepository = ReturnType<typeof createPushRepository>;
