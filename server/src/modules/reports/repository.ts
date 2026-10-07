import { and, count, desc, eq, gt, lt, sql } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { activeVotes, reports } from "../../db/schema.js";
import type {
  AuthorizedReportInput,
  Bathroom,
  ReportSummary,
} from "../../domain/reports.js";

export type ReportsRepository = {
  createWithCooldown(
    input: AuthorizedReportInput,
    cooldownSeconds: number,
    windowMinutes: number,
    now?: Date,
  ): Promise<{ created: boolean; retryAfterSeconds: number }>;
  findSummary(bathroom: Bathroom, now: Date): Promise<ReportSummary>;
  deleteExpired(before: Date): Promise<number>;
  ping(): Promise<void>;
};

export class IdempotencyConflictError extends Error {
  readonly statusCode = 409;
  constructor() {
    super("Idempotency key was already used for a different vote");
    this.name = "IdempotencyConflictError";
  }
}

export function createReportsRepository(db: Database): ReportsRepository {
  return {
    async createWithCooldown(
      input,
      cooldownSeconds,
      windowMinutes,
      now = new Date(),
    ) {
      return db.transaction(async (tx) => {
        const lockKey = `${input.anonymousId}:${input.building}:${input.floor}:${input.category}`;
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`,
        );
        const existing = await tx.query.reports.findFirst({
          where: eq(reports.idempotencyKey, input.idempotencyKey),
        });
        if (existing) {
          const matches =
            existing.anonymousId === input.anonymousId &&
            existing.building === input.building &&
            existing.floor === input.floor &&
            existing.category === input.category &&
            existing.available === input.available;
          if (!matches) throw new IdempotencyConflictError();
          return { created: false, retryAfterSeconds: 0 };
        }
        const latest = await tx.query.activeVotes.findFirst({
          where: and(
            eq(activeVotes.anonymousId, input.anonymousId),
            eq(activeVotes.building, input.building),
            eq(activeVotes.floor, input.floor),
            eq(activeVotes.category, input.category),
          ),
        });
        const retryAfterSeconds = latest
          ? Math.ceil(
              cooldownSeconds -
                (now.getTime() - latest.updatedAt.getTime()) / 1000,
            )
          : 0;
        if (retryAfterSeconds > 0) return { created: false, retryAfterSeconds };
        await tx.insert(reports).values({ ...input, createdAt: now });
        const expiresAt = new Date(now.getTime() + windowMinutes * 60_000);
        await tx
          .insert(activeVotes)
          .values({ ...input, updatedAt: now, expiresAt })
          .onConflictDoUpdate({
            target: [
              activeVotes.anonymousId,
              activeVotes.building,
              activeVotes.floor,
              activeVotes.category,
            ],
            set: { available: input.available, updatedAt: now, expiresAt },
          });
        return { created: true, retryAfterSeconds: 0 };
      });
    },
    async findSummary(bathroom, now) {
      const location = and(
        eq(activeVotes.building, bathroom.building),
        eq(activeVotes.floor, bathroom.floor),
        eq(activeVotes.category, bathroom.category),
        gt(activeVotes.expiresAt, now),
      );
      const [latest, totals] = await Promise.all([
        db.query.activeVotes.findFirst({
          where: location,
          orderBy: [desc(activeVotes.updatedAt)],
        }),
        db
          .select({
            yesCount: count(sql`case when ${activeVotes.available} then 1 end`),
            noCount: count(
              sql`case when not ${activeVotes.available} then 1 end`,
            ),
          })
          .from(activeVotes)
          .where(location),
      ]);
      const aggregate = totals[0] ?? { yesCount: 0, noCount: 0 };
      return {
        ...bathroom,
        available: latest?.available ?? null,
        reportedAt: latest?.updatedAt ?? null,
        yesCount: aggregate.yesCount,
        noCount: aggregate.noCount,
        expiresAt: latest?.expiresAt ?? null,
      };
    },
    async deleteExpired(before) {
      const deleted = await db
        .delete(reports)
        .where(lt(reports.createdAt, before))
        .returning({ id: reports.id });
      await db.delete(activeVotes).where(lt(activeVotes.expiresAt, before));
      return deleted.length;
    },
    async ping() {
      await db.execute(sql`select 1`);
    },
  };
}
