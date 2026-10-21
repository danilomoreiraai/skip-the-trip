import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as schema from "../../db/schema.js";
import { createOperationsRepository } from "../operations/repository.js";
import { createPushRepository } from "./repository.js";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL is required");
const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });
const operations = createOperationsRepository(db);
const repository = createPushRepository(
  db,
  Buffer.alloc(32, 1).toString("base64"),
);
const at = new Date("2026-10-20T10:00:00.000Z");
const bathroom = { building: "HH5", floor: "G", category: "Male" } as const;
const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/synthetic-private-endpoint",
  keys: { p256dh: "B" + "a".repeat(86), auth: "a".repeat(22) },
};
beforeAll(async () => migrate(db, { migrationsFolder: "drizzle" }));
beforeEach(async () =>
  pool.query(
    "truncate staff_members, staff_invites, staff_sessions, cleaning_cycles, cleaning_commands, push_subscriptions, cleaning_events, push_deliveries, reports, active_votes, location_authorizations cascade",
  ),
);
afterAll(async () => pool.end());
async function start() {
  const invite = await operations.issueInvite("test-cleaner", at);
  const member = await operations.redeemInvite(invite.code, at);
  if (!member) throw new Error("Fixture login failed");
  const body = {
    ...bathroom,
    action: "start" as const,
    minutes: 15 as const,
    commandId: randomUUID(),
  };
  const state = await operations.command(member.sessionHash, body, at);
  return { member, body, state };
}
describe("transactional cleaning notifications", () => {
  it("stores encrypted subscriptions, prevents takeover, delivers a committed start once and ignores extension/retry", async () => {
    await repository.save(
      "owner-a",
      bathroom,
      subscription,
      new Date(at.getTime() - 1000),
    );
    expect(
      JSON.stringify(
        (await pool.query("select * from push_subscriptions")).rows,
      ),
    ).not.toContain(subscription.endpoint);
    await expect(
      repository.save("owner-b", bathroom, subscription, at),
    ).rejects.toMatchObject({ statusCode: 409 });
    const { member, body, state } = await start();
    await operations.command(member.sessionHash, body, at);
    await operations.command(
      member.sessionHash,
      {
        ...bathroom,
        action: "extend",
        minutes: 30,
        cycleId: state.id,
        version: state.version,
        commandId: randomUUID(),
      },
      at,
    );
    const delivered: unknown[] = [];
    const send = async (value: unknown, payload: unknown) => {
      delivered.push({ value, payload });
    };
    await Promise.all([repository.drain(send, at), repository.drain(send, at)]);
    await repository.drain(send, at);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toMatchObject({
      value: subscription,
      payload: { cycleId: state.id, floor: "G", category: "Male" },
    });
    expect(
      (await pool.query("select count(*)::int as total from cleaning_events"))
        .rows[0].total,
    ).toBe(1);
  });
  it("never sends after unsubscribe, a favorite change, manual end or stale event", async () => {
    await repository.save(
      "owner-a",
      bathroom,
      subscription,
      new Date(at.getTime() - 1000),
    );
    const { member, state } = await start();
    await repository.save(
      "owner-a",
      { ...bathroom, floor: "1" },
      subscription,
      new Date(at.getTime() + 100),
    );
    const send = vi.fn();
    await repository.drain(send, new Date(at.getTime() + 200));
    expect(send).not.toHaveBeenCalled();
    await repository.remove("owner-a");
    expect(await repository.preference("owner-a", at)).toBeNull();
    await operations.command(
      member.sessionHash,
      {
        ...bathroom,
        action: "end",
        cycleId: state.id,
        version: state.version,
        commandId: randomUUID(),
      },
      at,
    );
    await repository.drain(send, new Date(at.getTime() + 60_000));
    expect(send).not.toHaveBeenCalled();
  });
  it("cleans up invalid subscriptions and retries transient failures without blocking staff", async () => {
    await repository.save(
      "owner-a",
      bathroom,
      subscription,
      new Date(at.getTime() - 1000),
    );
    await start();
    let attempts = 0;
    await repository.drain(async () => {
      attempts++;
      throw { statusCode: 503 };
    }, at);
    await repository.drain(
      async () => {
        attempts++;
        throw { statusCode: 410 };
      },
      new Date(at.getTime() + 10_000),
    );
    expect(attempts).toBe(2);
    expect(await repository.preference("owner-a", at)).toBeNull();
  });
  it("does not create events when a staff transaction fails or deliver old/newly-subscribed events", async () => {
    const { member, body } = await start();
    await expect(
      operations.command(
        member.sessionHash,
        { ...body, commandId: randomUUID() },
        at,
      ),
    ).rejects.toMatchObject({ code: "CLEANING_CONFLICT" });
    await repository.save(
      "owner-late",
      bathroom,
      subscription,
      new Date(at.getTime() + 1),
    );
    const delivered: unknown[] = [];
    await repository.drain(
      async (value) => {
        delivered.push(value);
      },
      new Date(at.getTime() + 61_000),
    );
    expect(delivered).toHaveLength(0);
    expect(
      (await pool.query("select count(*)::int as total from cleaning_events"))
        .rows[0].total,
    ).toBe(1);
  });
});
