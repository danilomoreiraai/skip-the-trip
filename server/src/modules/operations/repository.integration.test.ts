import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../db/schema.js";
import { createReportsRepository } from "../reports/repository.js";
import { createOperationsRepository } from "./repository.js";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL is required");
const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });
const operations = createOperationsRepository(db);
const reports = createReportsRepository(db);
const bathroom = { building: "HH5", floor: "G", category: "Male" } as const;
const at = new Date("2026-10-20T10:00:00.000Z");
beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
});
beforeEach(async () => {
  await pool.query(
    "truncate staff_members, staff_invites, staff_sessions, cleaning_cycles, cleaning_commands, reports, active_votes, location_authorizations cascade",
  );
});
afterAll(async () => pool.end());
async function session() {
  const invite = await operations.issueInvite("cleaner-test", at);
  const result = await operations.redeemInvite(invite.code, at);
  if (!result) throw new Error("Fixture invite failed");
  return { ...result, staffId: invite.staffId, invite };
}
function start(sessionHash: string, extra = {}) {
  return operations.command(
    sessionHash,
    {
      ...bathroom,
      action: "start",
      minutes: 15,
      commandId: randomUUID(),
      ...extra,
    },
    at,
  );
}
describe("PostgreSQL cleaner operations", () => {
  it("exchanges an invite once, stores hashes only, expires sessions at eight hours and revokes individually", async () => {
    const member = await session();
    expect(await operations.redeemInvite(member.invite.code, at)).toBeNull();
    expect(
      await operations.authenticate(
        member.sessionHash,
        new Date("2026-10-20T17:59:59.999Z"),
      ),
    ).toMatchObject({ building: "HH5" });
    expect(
      await operations.authenticate(
        member.sessionHash,
        new Date("2026-10-20T18:00:00.000Z"),
      ),
    ).toBeNull();
    const stored = await pool.query("select token_hash from staff_sessions");
    expect(JSON.stringify(stored.rows)).not.toContain(member.token);
    expect(
      JSON.stringify((await pool.query("select * from staff_invites")).rows),
    ).not.toContain(member.invite.code);
    await operations.revokeMember(member.staffId, at);
    expect(await operations.authenticate(member.sessionHash, at)).toBeNull();
    await expect(start(member.sessionHash)).rejects.toMatchObject({
      code: "STAFF_UNAUTHORIZED",
    });
  });
  it("rejects expired invites and consumes simultaneous redemption exactly once", async () => {
    const invite = await operations.issueInvite("cleaner-test", at);
    expect(
      await operations.redeemInvite(
        invite.code,
        new Date("2026-10-21T10:00:00.000Z"),
      ),
    ).toBeNull();
    const results = await Promise.all([
      operations.redeemInvite(invite.code, at),
      operations.redeemInvite(invite.code, at),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it("blocks votes during cleaning and releases at exact expiry without resurrecting earlier votes or resetting cooldown", async () => {
    const member = await session();
    const vote = {
      ...bathroom,
      anonymousId: randomUUID(),
      idempotencyKey: randomUUID(),
      available: true,
    };
    await reports.createWithCooldown(
      vote,
      300,
      30,
      new Date("2026-10-20T09:59:00.000Z"),
    );
    const cleaning = await start(member.sessionHash);
    expect(cleaning.expectedEndAt).toBe("2026-10-20T10:15:00.000Z");
    await expect(
      reports.createWithCooldown(
        { ...vote, idempotencyKey: randomUUID() },
        300,
        30,
        at,
      ),
    ).rejects.toMatchObject({ code: "CLEANING_IN_PROGRESS" });
    expect(await reports.findSummary(bathroom, at)).toMatchObject({
      available: null,
      yesCount: 0,
    });
    expect((await operations.buildingStates(at))[0]?.state).toBe("active");
    expect(
      (await operations.buildingStates(new Date("2026-10-20T10:15:00.000Z")))[0]
        ?.state,
    ).toBe("expired");
    expect(
      await reports.findSummary(bathroom, new Date("2026-10-20T10:15:00.000Z")),
    ).toMatchObject({ available: null, yesCount: 0 });
    expect(
      await reports.createWithCooldown(
        { ...vote, idempotencyKey: randomUUID() },
        300,
        30,
        new Date("2026-10-20T10:15:00.000Z"),
      ),
    ).toMatchObject({ created: true });
    expect(
      (await pool.query("select count(*)::int as total from reports")).rows[0]
        .total,
    ).toBe(2);
  });
  it("keeps cooldown through an early manual end and rejects stale commands", async () => {
    const member = await session();
    const vote = {
      ...bathroom,
      anonymousId: randomUUID(),
      idempotencyKey: randomUUID(),
      available: true,
    };
    await reports.createWithCooldown(
      vote,
      300,
      30,
      new Date("2026-10-20T09:59:00.000Z"),
    );
    const cleaning = await start(member.sessionHash);
    const ended = await operations.command(
      member.sessionHash,
      {
        ...bathroom,
        action: "end",
        cycleId: cleaning.id,
        version: cleaning.version,
        commandId: randomUUID(),
      },
      new Date("2026-10-20T10:01:00.000Z"),
    );
    expect(ended.state).toBe("ended");
    expect(
      await reports.createWithCooldown(
        { ...vote, idempotencyKey: randomUUID() },
        300,
        30,
        new Date("2026-10-20T10:01:00.000Z"),
      ),
    ).toMatchObject({ created: false, retryAfterSeconds: 180 });
    await expect(
      operations.command(
        member.sessionHash,
        {
          ...bathroom,
          action: "extend",
          minutes: 30,
          cycleId: cleaning.id,
          version: cleaning.version,
          commandId: randomUUID(),
        },
        at,
      ),
    ).rejects.toMatchObject({ code: "CLEANING_CONFLICT" });
  });
  it("deduplicates commands, rejects changed retries and serializes simultaneous starts", async () => {
    const member = await session();
    const commandId = randomUUID();
    const [one, two] = await Promise.all([
      start(member.sessionHash, { commandId }),
      start(member.sessionHash, { commandId }),
    ]);
    expect(one.id).toBe(two.id);
    expect(
      (await pool.query("select count(*)::int as total from cleaning_cycles"))
        .rows[0].total,
    ).toBe(1);
    await expect(
      start(member.sessionHash, { commandId, minutes: 30 }),
    ).rejects.toMatchObject({ code: "CLEANING_CONFLICT" });
    await expect(start(member.sessionHash)).rejects.toMatchObject({
      code: "CLEANING_CONFLICT",
    });
    const extended = await operations.command(
      member.sessionHash,
      {
        ...bathroom,
        action: "extend",
        minutes: 30,
        cycleId: one.id,
        version: one.version,
        commandId: randomUUID(),
      },
      new Date("2026-10-20T10:01:00.000Z"),
    );
    expect(extended.expectedEndAt).toBe("2026-10-20T10:31:00.000Z");
    expect(
      (await reports.findBuildingSummaries("HH5", at)).find(
        (b) => b.floor === "G" && b.category === "Male",
      )?.available,
    ).toBeNull();
  });
  it("serializes a cleaning start and a simultaneous vote and scopes the block to one bathroom", async () => {
    const member = await session();
    const input = {
      ...bathroom,
      anonymousId: randomUUID(),
      idempotencyKey: randomUUID(),
      available: true,
    };
    const results = await Promise.allSettled([
      start(member.sessionHash),
      reports.createWithCooldown(input, 300, 30, at),
    ]);
    expect(results[0]?.status).toBe("fulfilled");
    if (results[1]?.status === "rejected")
      expect(results[1].reason).toMatchObject({ code: "CLEANING_IN_PROGRESS" });
    expect(await reports.findSummary(bathroom, at)).toMatchObject({
      available: null,
    });
    expect(
      await reports.createWithCooldown(
        { ...input, floor: "1", idempotencyKey: randomUUID() },
        300,
        30,
        at,
      ),
    ).toMatchObject({ created: true });
  });
});
