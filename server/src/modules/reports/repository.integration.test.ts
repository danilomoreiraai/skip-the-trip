import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../db/schema.js";
import type { CreateReportInput } from "../../domain/reports.js";
import { createReportsRepository } from "./repository.js";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) {
  throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
}

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });
const repository = createReportsRepository(db);
const bathroom = { building: "HH1", floor: "G", category: "Male" } as const;

function vote(overrides: Partial<CreateReportInput> = {}): CreateReportInput {
  return {
    ...bathroom,
    available: true,
    clientId: randomUUID(),
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(async () => {
  await pool.query("truncate table reports restart identity");
});

afterAll(async () => {
  await pool.end();
});

describe("PostgreSQL reports repository", () => {
  it("persists votes and returns the latest state with aggregate counts", async () => {
    await repository.create(vote({ available: true }));
    await repository.create(vote({ available: false }));

    const summary = await repository.findSummary(
      bathroom,
      new Date(0),
      (reportedAt) => new Date(reportedAt.getTime() + 30 * 60_000),
    );

    expect(summary).toMatchObject({
      ...bathroom,
      available: false,
      yesCount: 1,
      noCount: 1,
    });
    expect(summary.reportedAt).toBeInstanceOf(Date);
    const reportedAt = summary.reportedAt;
    if (!reportedAt) throw new Error("Expected the latest report timestamp");
    expect(summary.expiresAt?.getTime()).toBe(
      reportedAt.getTime() + 30 * 60_000,
    );
  });

  it("counts an idempotent retry only once", async () => {
    const retriedVote = vote();
    await repository.create(retriedVote);
    await repository.create(retriedVote);

    const summary = await repository.findSummary(
      bathroom,
      new Date(0),
      (reportedAt) => new Date(reportedAt.getTime() + 30 * 60_000),
    );

    expect(summary).toMatchObject({ available: true, yesCount: 1, noCount: 0 });
  });

  it("serializes simultaneous votes from the same device and bathroom", async () => {
    const clientId = randomUUID();
    const results = await Promise.all([
      repository.createWithCooldown(vote({ clientId }), 300),
      repository.createWithCooldown(vote({ clientId, available: false }), 300),
    ]);

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results.filter((result) => result.retryAfterSeconds > 0)).toHaveLength(1);

    const summary = await repository.findSummary(
      bathroom,
      new Date(0),
      (reportedAt) => new Date(reportedAt.getTime() + 30 * 60_000),
    );
    expect(summary.yesCount + summary.noCount).toBe(1);
  });

  it("excludes votes outside the requested freshness window", async () => {
    await repository.create(vote());

    const summary = await repository.findSummary(
      bathroom,
      new Date(Date.now() + 60_000),
      (reportedAt) => new Date(reportedAt.getTime() + 30 * 60_000),
    );

    expect(summary).toEqual({
      ...bathroom,
      available: null,
      reportedAt: null,
      yesCount: 0,
      noCount: 0,
      expiresAt: null,
    });
  });

  it("deletes reports older than the retention cutoff", async () => {
    await repository.create(vote());
    expect(await repository.deleteExpired(new Date(Date.now() + 60_000))).toBe(1);

    const summary = await repository.findSummary(
      bathroom,
      new Date(0),
      (reportedAt) => new Date(reportedAt.getTime() + 30 * 60_000),
    );
    expect(summary.available).toBeNull();
    expect(summary.yesCount).toBe(0);
  });
});
