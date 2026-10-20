import { and, desc, eq, gt, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import {
  cleaningCommands,
  cleaningCycles,
  staffInvites,
  staffMembers,
  staffSessions,
} from "../../db/schema.js";
import {
  type CleaningCommand,
  type CleaningState,
  hashToken,
  OperationsError,
  token,
} from "../../domain/cleaning.js";

type Executor =
  | Database
  | Parameters<Parameters<Database["transaction"]>[0]>[0];
async function databaseNow(db: Executor, at?: Date) {
  return (
    at ??
    new Date(
      (await db.execute<{ now: string }>(sql`select clock_timestamp() as now`))
        .rows[0]!.now,
    )
  );
}
async function authenticated(
  db: Executor,
  sessionHash: string,
  now: Date,
  lock = false,
) {
  const query = db
    .select({
      staffId: staffMembers.id,
      building: staffMembers.building,
      expiresAt: staffSessions.expiresAt,
    })
    .from(staffSessions)
    .innerJoin(staffMembers, eq(staffMembers.id, staffSessions.staffId))
    .where(
      and(
        eq(staffSessions.tokenHash, sessionHash),
        gt(staffSessions.expiresAt, now),
        isNull(staffMembers.revokedAt),
      ),
    );
  const [result] = lock ? await query.for("share") : await query;
  return result?.building === "HH5" ? result : null;
}
function view(
  row: typeof cleaningCycles.$inferSelect,
  now: Date,
): CleaningState {
  return {
    id: row.id,
    building: "HH5",
    floor: row.floor as CleaningState["floor"],
    category: row.category,
    state: row.endedAt
      ? "ended"
      : row.expectedEndAt > now
        ? "active"
        : "expired",
    startedAt: row.startedAt.toISOString(),
    expectedEndAt: row.expectedEndAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}
export function createOperationsRepository(db: Database) {
  return {
    async issueInvite(label: string, at?: Date) {
      if (!label.trim() || label.length > 80)
        throw new Error("A staff alias of 1–80 characters is required");
      return db.transaction(async (tx) => {
        const now = await databaseNow(tx, at);
        const [member] = await tx
          .insert(staffMembers)
          .values({ label })
          .returning();
        const code = token();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60_000);
        await tx.insert(staffInvites).values({
          tokenHash: hashToken(code),
          staffId: member!.id,
          expiresAt,
        });
        return { code, staffId: member!.id, expiresAt };
      });
    },
    async redeemInvite(code: string, at?: Date) {
      const tokenHash = hashToken(code);
      return db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`invite:${tokenHash}`}))`,
        );
        const now = await databaseNow(tx, at);
        const invite = await tx.query.staffInvites.findFirst({
          where: and(
            eq(staffInvites.tokenHash, tokenHash),
            gt(staffInvites.expiresAt, now),
            isNull(staffInvites.usedAt),
          ),
        });
        if (!invite) return null;
        const [member] = await tx
          .select()
          .from(staffMembers)
          .where(
            and(
              eq(staffMembers.id, invite.staffId),
              isNull(staffMembers.revokedAt),
            ),
          )
          .for("share");
        if (!member || member.building !== "HH5") return null;
        const used = await tx
          .update(staffInvites)
          .set({ usedAt: now })
          .where(
            and(
              eq(staffInvites.tokenHash, tokenHash),
              isNull(staffInvites.usedAt),
            ),
          )
          .returning();
        if (!used.length) return null;
        const raw = token();
        const sessionHash = hashToken(raw);
        const expiresAt = new Date(now.getTime() + 8 * 60 * 60_000);
        await tx
          .insert(staffSessions)
          .values({ tokenHash: sessionHash, staffId: member.id, expiresAt });
        return { token: raw, sessionHash, expiresAt, building: "HH5" as const };
      });
    },
    async authenticate(sessionHash: string, at?: Date) {
      return authenticated(db, sessionHash, await databaseNow(db, at));
    },
    async logout(sessionHash: string) {
      await db
        .delete(staffSessions)
        .where(eq(staffSessions.tokenHash, sessionHash));
    },
    async revokeMember(staffId: string, at?: Date) {
      await db.transaction(async (tx) => {
        await tx
          .update(staffMembers)
          .set({ revokedAt: await databaseNow(tx, at) })
          .where(eq(staffMembers.id, staffId));
        await tx
          .delete(staffSessions)
          .where(eq(staffSessions.staffId, staffId));
        await tx.delete(staffInvites).where(eq(staffInvites.staffId, staffId));
      });
    },
    async buildingStates(at?: Date): Promise<CleaningState[]> {
      const now = await databaseNow(db, at);
      const rows = await db
        .selectDistinctOn([
          cleaningCycles.building,
          cleaningCycles.floor,
          cleaningCycles.category,
        ])
        .from(cleaningCycles)
        .where(eq(cleaningCycles.building, "HH5"))
        .orderBy(
          cleaningCycles.building,
          cleaningCycles.floor,
          cleaningCycles.category,
          desc(cleaningCycles.sequence),
        );
      return rows.map((row) => view(row, now));
    },
    async command(
      sessionHash: string,
      input: CleaningCommand,
      at?: Date,
    ): Promise<CleaningState> {
      return db.transaction(async (tx) => {
        const key = `${input.building}:${input.floor}:${input.category}`;
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`bathroom:${key}`}))`,
        );
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`cleaning-command:${input.commandId}`}))`,
        );
        const now = await databaseNow(tx, at);
        const member = await authenticated(tx, sessionHash, now, true);
        if (!member) throw new OperationsError("STAFF_UNAUTHORIZED", 401);
        const fingerprint = hashToken(
          JSON.stringify({ staffId: member.staffId, ...input }),
        );
        const previous = await tx.query.cleaningCommands.findFirst({
          where: eq(cleaningCommands.commandId, input.commandId),
        });
        if (previous) {
          if (previous.fingerprint !== fingerprint)
            throw new OperationsError("CLEANING_CONFLICT", 409);
          return previous.result;
        }
        const latest = await tx.query.cleaningCycles.findFirst({
          where: and(
            eq(cleaningCycles.building, input.building),
            eq(cleaningCycles.floor, input.floor),
            eq(cleaningCycles.category, input.category),
          ),
          orderBy: [desc(cleaningCycles.sequence)],
        });
        let changed: typeof cleaningCycles.$inferSelect | undefined;
        if (input.action === "start") {
          if (latest && !latest.endedAt && latest.expectedEndAt > now)
            throw new OperationsError("CLEANING_CONFLICT", 409);
          [changed] = await tx
            .insert(cleaningCycles)
            .values({
              building: input.building,
              floor: input.floor,
              category: input.category,
              startedBy: member.staffId,
              startedAt: now,
              updatedAt: now,
              expectedEndAt: new Date(now.getTime() + input.minutes * 60_000),
            })
            .returning();
        } else {
          if (
            !latest ||
            latest.id !== input.cycleId ||
            latest.version !== input.version ||
            latest.endedAt ||
            (input.action === "extend" && latest.expectedEndAt <= now)
          )
            throw new OperationsError("CLEANING_CONFLICT", 409);
          [changed] = await tx
            .update(cleaningCycles)
            .set({
              version: latest.version + 1,
              updatedAt: now,
              ...(input.action === "end"
                ? { endedAt: now }
                : {
                    expectedEndAt: new Date(
                      now.getTime() + input.minutes * 60_000,
                    ),
                  }),
            })
            .where(eq(cleaningCycles.id, latest.id))
            .returning();
        }
        const result = view(changed!, now);
        await tx.insert(cleaningCommands).values({
          commandId: input.commandId,
          staffId: member.staffId,
          fingerprint,
          action: input.action,
          result,
          createdAt: now,
        });
        return result;
      });
    },
    async prune(before: Date, now = new Date()) {
      await db.transaction(async (tx) => {
        await tx
          .delete(staffInvites)
          .where(
            or(
              lte(staffInvites.expiresAt, now),
              lt(staffInvites.usedAt, before),
            ),
          );
        await tx.delete(staffSessions).where(lte(staffSessions.expiresAt, now));
        await tx
          .delete(cleaningCommands)
          .where(lt(cleaningCommands.createdAt, before));
        await tx
          .delete(cleaningCycles)
          .where(
            and(
              lt(cleaningCycles.startedAt, before),
              lte(cleaningCycles.expectedEndAt, now),
            ),
          );
        await tx.delete(staffMembers).where(lt(staffMembers.revokedAt, before));
      });
    },
  };
}
export type OperationsRepository = ReturnType<
  typeof createOperationsRepository
>;
