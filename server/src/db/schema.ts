import {
  boolean,
  index,
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
