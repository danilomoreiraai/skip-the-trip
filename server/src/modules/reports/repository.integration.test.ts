import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../db/schema.js";
import type { AuthorizedReportInput } from "../../domain/reports.js";
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
    "truncate table reports, active_votes, location_authorizations restart identity",
  );
});
afterAll(async () => {
  await pool.end();
});

describe("PostgreSQL reports repository", () => {
  it("keeps one active contribution per identity and updates its status after cooldown", async () => {
    const anonymousId = randomUUID();
    const first = new Date("2026-10-07T10:00:00.000Z");
    await repository.createWithCooldown(vote({ anonymousId }), 300, 30, first);
    await repository.createWithCooldown(
      vote({ anonymousId, available: false }),
      300,
      30,
      new Date("2026-10-07T10:05:00.000Z"),
    );
    const summary = await repository.findSummary(
      bathroom,
      new Date("2026-10-07T10:05:01.000Z"),
    );
    expect(summary).toMatchObject({
      available: false,
      yesCount: 0,
      noCount: 1,
    });
    expect(summary.expiresAt).toEqual(new Date("2026-10-07T10:35:00.000Z"));
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

  it("excludes expired votes without waiting for physical cleanup", async () => {
    await repository.createWithCooldown(
      vote(),
      300,
      30,
      new Date("2026-10-07T10:00:00.000Z"),
    );
    const summary = await repository.findSummary(
      bathroom,
      new Date("2026-10-07T10:30:00.000Z"),
    );
    expect(summary).toMatchObject({ available: null, yesCount: 0, noCount: 0 });
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
});
