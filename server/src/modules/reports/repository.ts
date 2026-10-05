import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { reports } from "../../db/schema.js";
import type { Bathroom, CreateReportInput, ReportSummary } from "../../domain/reports.js";

export type ReportsRepository = {
  create(input: CreateReportInput): Promise<void>;
  findSummary(bathroom: Bathroom, since: Date, expiresAt: (reportedAt: Date) => Date): Promise<ReportSummary>;
  deleteExpired(before: Date): Promise<number>;
  ping(): Promise<void>;
};

export function createReportsRepository(db: Database): ReportsRepository {
  return {
    async create(input) {
      await db.insert(reports).values(input).onConflictDoNothing({ target: reports.idempotencyKey });
    },
    async findSummary(bathroom, since, expiresAt) {
      const location = and(
        eq(reports.building, bathroom.building),
        eq(reports.floor, bathroom.floor),
        eq(reports.category, bathroom.category),
        gte(reports.createdAt, since),
      );
      const [latest, totals] = await Promise.all([
        db.query.reports.findFirst({ where: location, orderBy: [desc(reports.createdAt)] }),
        db
          .select({
            yesCount: count(sql`case when ${reports.available} then 1 end`),
            noCount: count(sql`case when not ${reports.available} then 1 end`),
          })
          .from(reports)
          .where(location),
      ]);
      const aggregate = totals[0] ?? { yesCount: 0, noCount: 0 };
      return {
        ...bathroom,
        available: latest?.available ?? null,
        reportedAt: latest?.createdAt ?? null,
        yesCount: aggregate.yesCount,
        noCount: aggregate.noCount,
        expiresAt: latest ? expiresAt(latest.createdAt) : null,
      };
    },
    async deleteExpired(before) {
      const deleted = await db
        .delete(reports)
        .where(lt(reports.createdAt, before))
        .returning({ id: reports.id });
      return deleted.length;
    },
    async ping() {
      await db.execute(sql`select 1`);
    },
  };
}
