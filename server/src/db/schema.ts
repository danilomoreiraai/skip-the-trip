import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const bathroomCategory = pgEnum("bathroom_category", [
  "Male",
  "Accessible",
  "Female",
]);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    building: varchar("building", { length: 3 }).notNull(),
    floor: varchar("floor", { length: 1 }).notNull(),
    category: bathroomCategory("category").notNull(),
    available: boolean("available").notNull(),
    anonymousId: uuid("client_id").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("reports_idempotency_key_unique").on(table.idempotencyKey),
    index("reports_bathroom_created_at_idx").on(
      table.building,
      table.floor,
      table.category,
      table.createdAt,
    ),
    index("reports_client_created_at_idx").on(
      table.anonymousId,
      table.createdAt,
    ),
  ],
);

export const locationAuthorizations = pgTable(
  "location_authorizations",
  {
    anonymousId: uuid("anonymous_id").notNull(),
    locationId: varchar("location_id", { length: 16 }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.anonymousId, table.locationId] }),
    index("location_authorizations_expires_at_idx").on(table.expiresAt),
  ],
);

export const activeVotes = pgTable(
  "active_votes",
  {
    anonymousId: uuid("anonymous_id").notNull(),
    building: varchar("building", { length: 3 }).notNull(),
    floor: varchar("floor", { length: 1 }).notNull(),
    category: bathroomCategory("category").notNull(),
    available: boolean("available").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.anonymousId, table.building, table.floor, table.category],
    }),
    index("active_votes_bathroom_expires_at_idx").on(
      table.building,
      table.floor,
      table.category,
      table.expiresAt,
    ),
  ],
);

export const staffMembers = pgTable("staff_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: varchar("label", { length: 80 }).notNull(),
  building: varchar("building", { length: 3 }).notNull().default("HH5"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});
export const staffInvites = pgTable(
  "staff_invites",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffMembers.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => [index("staff_invites_expires_idx").on(table.expiresAt)],
);
export const staffSessions = pgTable(
  "staff_sessions",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffMembers.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("staff_sessions_expires_idx").on(table.expiresAt)],
);
export const cleaningCycles = pgTable(
  "cleaning_cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sequence: bigserial("sequence", { mode: "number" }).notNull(),
    building: varchar("building", { length: 3 }).notNull(),
    floor: varchar("floor", { length: 1 }).notNull(),
    category: bathroomCategory("category").notNull(),
    startedBy: uuid("started_by").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    expectedEndAt: timestamp("expected_end_at", {
      withTimezone: true,
    }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("cleaning_bathroom_sequence_idx").on(
      table.building,
      table.floor,
      table.category,
      table.sequence,
    ),
  ],
);
export const cleaningCommands = pgTable(
  "cleaning_commands",
  {
    commandId: uuid("command_id").primaryKey(),
    staffId: uuid("staff_id").notNull(),
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
    action: varchar("action", { length: 8 }).notNull(),
    result: jsonb("result")
      .$type<import("../domain/cleaning.js").CleaningState>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("cleaning_commands_created_idx").on(table.createdAt)],
);
