import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../db/schema.js";
import type { AuthorizedReportInput } from "../../domain/reports.js";
import { pruneReports } from "../../functions/prune-reports.js";
import { createLocationAuthorizationsRepository } from "../location-authorizations/repository.js";
import {
  createReportsRepository,
  IdempotencyConflictError,
} from "./repository.js";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString)
  throw new Error(
    "TEST_DATABASE_URL is required for PostgreSQL integration tests",
  );
const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });
const repository = createReportsRepository(db);
const authorizations = createLocationAuthorizationsRepository(db);
const bathroom = { building: "HH5", floor: "G", category: "Male" } as const;

function vote(
  overrides: Partial<AuthorizedReportInput> = {},
): AuthorizedReportInput {
  return {
    ...bathroom,
    available: true,
    anonymousId: randomUUID(),
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
});
beforeEach(async () => {
  await pool.query(
    "truncate table reports, active_votes, bathroom_status, location_authorizations restart identity",
  );
});
afterAll(async () => {
  await pool.end();
});

describe("PostgreSQL reports repository", () => {
  it("shows every bathroom as available by default, with no report time", async () => {
    const summary = await repository.findBuildingSummaries(
      "HH5",
      new Date("2026-10-20T08:00:00.000Z"),
    );
    expect(summary).toHaveLength(12);
    for (const entry of summary)
      expect(entry).toMatchObject({
        available: true,
        reportedAt: null,
        expiresAt: null,
        yesCount: 0,
        noCount: 0,
      });
  });

  it("keeps YES available indefinitely and records the last report time", async () => {
    const reportedAt = new Date("2026-10-20T10:00:00.000Z");
    await repository.createWithCooldown(vote(), 300, 30, reportedAt);
    const summary = await repository.findSummary(
      bathroom,
      new Date("2026-10-20T18:00:00.000Z"),
    );
    expect(summary).toMatchObject({
      available: true,
      reportedAt,
      expiresAt: null,
    });
  });

  it("closes the bathroom for 30 minutes on NO, then returns to available", async () => {
    const reportedAt = new Date("2026-10-20T10:00:00.000Z");
    await repository.createWithCooldown(
      vote({ available: false }),
      300,
      30,
      reportedAt,
    );
    const closed = await repository.findSummary(
      bathroom,
      new Date("2026-10-20T10:29:59.000Z"),
    );
    expect(closed).toMatchObject({
      available: false,
      reportedAt,
      expiresAt: new Date("2026-10-20T10:30:00.000Z"),
    });
    const reopened = await repository.findSummary(
      bathroom,
      new Date("2026-10-20T10:30:00.000Z"),
    );
    expect(reopened).toMatchObject({ available: true, reportedAt });
  });

  it("reopens immediately when someone reports YES during a closure", async () => {
    await repository.createWithCooldown(
      vote({ available: false }),
      300,
      30,
      new Date("2026-10-20T10:00:00.000Z"),
    );
    const yesAt = new Date("2026-10-20T10:10:00.000Z");
    await repository.createWithCooldown(vote(), 300, 30, yesAt);
    const summary = await repository.findSummary(
      bathroom,
      new Date("2026-10-20T10:11:00.000Z"),
    );
    expect(summary).toMatchObject({
      available: true,
      reportedAt: yesAt,
      expiresAt: null,
    });
  });

  it("restarts the 30 minute closure when another NO arrives", async () => {
    await repository.createWithCooldown(
      vote({ available: false }),
      300,
      30,
      new Date("2026-10-20T10:00:00.000Z"),
    );
    await repository.createWithCooldown(
      vote({ available: false }),
      300,
      30,
      new Date("2026-10-20T10:20:00.000Z"),
    );
    const summary = await repository.findSummary(
      bathroom,
      new Date("2026-10-20T10:40:00.000Z"),
    );
    expect(summary).toMatchObject({
      available: false,
      expiresAt: new Date("2026-10-20T10:50:00.000Z"),
    });
  });

  it("counts every accepted vote of the day per bathroom", async () => {
    const now = new Date("2026-10-08T10:00:00.000Z");
    await repository.createWithCooldown(vote(), 300, 30, now);
    await repository.createWithCooldown(vote(), 300, 30, now);
    await repository.createWithCooldown(
      vote({ available: false }),
      300,
      30,
      now,
    );
    await repository.createWithCooldown(
      vote({ floor: "2", category: "Female", available: false }),
      300,
      30,
      now,
    );
    expect(await repository.findSummary(bathroom, now)).toMatchObject({
      yesCount: 2,
      noCount: 1,
    });
    const building = await repository.findBuildingSummaries("HH5", now);
    expect(
      building.find((b) => b.floor === "G" && b.category === "Male"),
    ).toMatchObject({ yesCount: 2, noCount: 1 });
    expect(
      building.find((b) => b.floor === "2" && b.category === "Female"),
    ).toMatchObject({ yesCount: 0, noCount: 1 });
    expect(
      building.find((b) => b.floor === "1" && b.category === "Male"),
    ).toMatchObject({ yesCount: 0, noCount: 0 });
  });

  it("resets the counters at local midnight", async () => {
    // Europe/Dublin is UTC+1 in July: 22:30Z is 23:30 local, 23:30Z is 00:30 next day.
    await repository.createWithCooldown(
      vote(),
      300,
      30,
      new Date("2026-07-10T22:30:00.000Z"),
    );
    await repository.createWithCooldown(
      vote({ available: false }),
      300,
      30,
      new Date("2026-07-10T23:30:00.000Z"),
    );
    expect(
      await repository.findSummary(
        bathroom,
        new Date("2026-07-10T22:45:00.000Z"),
      ),
    ).toMatchObject({ yesCount: 1, noCount: 0 });
    expect(
      await repository.findSummary(
        bathroom,
        new Date("2026-07-10T23:45:00.000Z"),
      ),
    ).toMatchObject({ yesCount: 0, noCount: 1 });
  });

  it("lets one identity vote again after the cooldown", async () => {
    const anonymousId = randomUUID();
    await repository.createWithCooldown(
      vote({ anonymousId }),
      300,
      30,
      new Date("2026-10-07T10:00:00.000Z"),
    );
    const early = await repository.createWithCooldown(
      vote({ anonymousId, available: false }),
      300,
      30,
      new Date("2026-10-07T10:04:00.000Z"),
    );
    expect(early).toEqual({ created: false, retryAfterSeconds: 60 });
    await repository.createWithCooldown(
      vote({ anonymousId, available: false }),
      300,
      30,
      new Date("2026-10-07T10:05:00.000Z"),
    );
    expect(
      await repository.findSummary(
        bathroom,
        new Date("2026-10-07T10:06:00.000Z"),
      ),
    ).toMatchObject({ available: false, yesCount: 1, noCount: 1 });
  });

  it("serializes simultaneous votes and preserves idempotent retries", async () => {
    const input = vote();
    const competing = { ...input, idempotencyKey: randomUUID() };
    const [first, second] = await Promise.all([
      repository.createWithCooldown(input, 300, 30),
      repository.createWithCooldown(competing, 300, 30),
    ]);
    expect([first, second].filter((result) => result.created)).toHaveLength(1);
    const retry = await repository.createWithCooldown(
      first.created ? input : competing,
      300,
      30,
    );
    expect(retry).toEqual({ created: false, retryAfterSeconds: 0 });
  });

  it("rejects incompatible reuse of an idempotency key", async () => {
    const input = vote();
    await repository.createWithCooldown(input, 300, 30);
    await expect(
      repository.createWithCooldown({ ...input, available: false }, 300, 30),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });
});

describe("PostgreSQL location authorization repository", () => {
  it("reuses a valid authorization without extending it and replaces an expired one", async () => {
    const anonymousId = randomUUID();
    const first = {
      verifiedAt: new Date("2026-10-07T10:00:00.000Z"),
      expiresAt: new Date("2026-10-07T14:00:00.000Z"),
    };
    await authorizations.authorize(anonymousId, "HH5", first, first.verifiedAt);
    const reused = await authorizations.authorize(
      anonymousId,
      "HH5",
      {
        verifiedAt: new Date("2026-10-07T11:00:00.000Z"),
        expiresAt: new Date("2026-10-07T15:00:00.000Z"),
      },
      new Date("2026-10-07T11:00:00.000Z"),
    );
    expect(reused).toEqual(first);
    const renewed = await authorizations.authorize(
      anonymousId,
      "HH5",
      {
        verifiedAt: new Date("2026-10-07T14:00:00.000Z"),
        expiresAt: new Date("2026-10-07T18:00:00.000Z"),
      },
      new Date("2026-10-07T14:00:00.000Z"),
    );
    expect(renewed.expiresAt).toEqual(new Date("2026-10-07T18:00:00.000Z"));
  });

  it("physically deletes expired authorizations with retained report data", async () => {
    const expiredAt = new Date("2026-10-11T13:00:00.000Z");
    const validUntil = new Date("2026-10-11T16:00:00.000Z");
    await repository.createWithCooldown(
      vote(),
      300,
      30,
      new Date("2026-08-01T10:00:00.000Z"),
    );
    await repository.createWithCooldown(
      vote(),
      300,
      30,
      new Date("2026-10-01T10:00:00.000Z"),
    );
    await authorizations.authorize(
      randomUUID(),
      "HH5",
      {
        expiresAt: expiredAt,
        verifiedAt: new Date("2026-10-10T04:00:00.000Z"),
      },
      new Date("2026-10-10T04:00:00.000Z"),
    );
    await authorizations.authorize(
      randomUUID(),
      "HH5",
      {
        expiresAt: validUntil,
        verifiedAt: new Date("2026-10-11T12:00:00.000Z"),
      },
      new Date("2026-10-11T12:00:00.000Z"),
    );

    await expect(
      pruneReports(
        repository,
        authorizations,
        30,
        new Date("2026-10-11T13:00:00.000Z"),
      ),
    ).resolves.toEqual({
      activeVotes: 1,
      locationAuthorizations: 1,
      reports: 1,
      total: 3,
    });
    await expect(
      repository.findSummary(bathroom, new Date("2026-10-11T13:00:00.000Z")),
    ).resolves.toMatchObject({
      available: true,
      reportedAt: new Date("2026-10-01T10:00:00.000Z"),
    });
  });
});
