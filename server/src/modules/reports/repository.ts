import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { activeVotes, bathroomStatus, reports } from "../../db/schema.js";
import { BUILDING_TIME_ZONES } from "../../domain/locations.js";
import type {
  AuthorizedReportInput,
  Bathroom,
  ReportSummary,
} from "../../domain/reports.js";
import {
  bathroomCategories,
  floors,
  resolveBathroomStatus,
} from "../../domain/reports.js";

export type ReportsRepository = {
  createWithCooldown(
    input: AuthorizedReportInput,
    cooldownSeconds: number,
    windowMinutes: number,
    now?: Date,
  ): Promise<{ created: boolean; retryAfterSeconds: number }>;
  findBuildingSummaries(building: "HH5", now: Date): Promise<ReportSummary[]>;
  findSummary(bathroom: Bathroom, now: Date): Promise<ReportSummary>;
  deleteExpired(
    before: Date,
  ): Promise<{ activeVotes: number; reports: number }>;
  ping(): Promise<void>;
};

export class IdempotencyConflictError extends Error {
  readonly statusCode = 409;
  constructor() {
    super("Idempotency key was already used for a different vote");
    this.name = "IdempotencyConflictError";
  }
}

export function createReportsRepository(
  db: Database,
  timeZones: Record<Bathroom["building"], string> = BUILDING_TIME_ZONES,
): ReportsRepository {
  const localDay = (building: Bathroom["building"], now: Date) => {
    const timeZone = timeZones[building];
    const localStart = sql`date_trunc('day', ${now.toISOString()}::timestamptz at time zone ${timeZone})`;
    return and(
      gte(reports.createdAt, sql`(${localStart} at time zone ${timeZone})`),
      lt(
        reports.createdAt,
        sql`((${localStart} + interval '1 day') at time zone ${timeZone})`,
      ),
    );
  };
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
        const closedUntil = input.available ? null : expiresAt;
        await tx
          .insert(bathroomStatus)
          .values({
            building: input.building,
            floor: input.floor,
            category: input.category,
            available: input.available,
            lastReportedAt: now,
            closedUntil,
          })
          .onConflictDoUpdate({
            target: [
              bathroomStatus.building,
              bathroomStatus.floor,
              bathroomStatus.category,
            ],
            set: {
              available: input.available,
              lastReportedAt: now,
              closedUntil,
            },
          });
        return { created: true, retryAfterSeconds: 0 };
      });
    },
    async findBuildingSummaries(building, now) {
      const [statuses, totals] = await Promise.all([
        db.query.bathroomStatus.findMany({
          where: eq(bathroomStatus.building, building),
        }),
        db
          .select({
            floor: reports.floor,
            category: reports.category,
            yesCount: sql<number>`count(*) filter (where ${reports.available})::int`,
            noCount: sql<number>`count(*) filter (where not ${reports.available})::int`,
          })
          .from(reports)
          .where(and(eq(reports.building, building), localDay(building, now)))
          .groupBy(reports.floor, reports.category),
      ]);
      return floors.flatMap((floor) =>
        bathroomCategories.map((category) => {
          const status = statuses.find(
            (row) => row.floor === floor && row.category === category,
          );
          const daily = totals.find(
            (row) => row.floor === floor && row.category === category,
          );
          return {
            building,
            floor,
            category,
            ...resolveBathroomStatus(status, now),
            yesCount: daily?.yesCount ?? 0,
            noCount: daily?.noCount ?? 0,
          };
        }),
      );
    },
    async findSummary(bathroom, now) {
      const [status, totals] = await Promise.all([
        db.query.bathroomStatus.findFirst({
          where: and(
            eq(bathroomStatus.building, bathroom.building),
            eq(bathroomStatus.floor, bathroom.floor),
            eq(bathroomStatus.category, bathroom.category),
          ),
        }),
        db
          .select({
            yesCount: sql<number>`count(*) filter (where ${reports.available})::int`,
            noCount: sql<number>`count(*) filter (where not ${reports.available})::int`,
          })
          .from(reports)
          .where(
            and(
              eq(reports.building, bathroom.building),
              eq(reports.floor, bathroom.floor),
              eq(reports.category, bathroom.category),
              localDay(bathroom.building, now),
            ),
          ),
      ]);
      const daily = totals[0] ?? { yesCount: 0, noCount: 0 };
      return {
        ...bathroom,
        ...resolveBathroomStatus(status, now),
        yesCount: daily.yesCount,
        noCount: daily.noCount,
      };
    },
    async deleteExpired(before) {
      const deletedReports = await db
        .delete(reports)
        .where(lt(reports.createdAt, before))
        .returning({ id: reports.id });
      const deletedActiveVotes = await db
        .delete(activeVotes)
        .where(lt(activeVotes.expiresAt, before))
        .returning({ anonymousId: activeVotes.anonymousId });
      return {
        activeVotes: deletedActiveVotes.length,
        reports: deletedReports.length,
      };
    },
    async ping() {
      await db.execute(sql`select 1`);
    },
  };
}
