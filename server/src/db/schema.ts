import { boolean, index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const bathroomCategory = pgEnum("bathroom_category", ["Male", "Accessible", "Female"]);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    building: varchar("building", { length: 3 }).notNull(),
    floor: varchar("floor", { length: 1 }).notNull(),
    category: bathroomCategory("category").notNull(),
    available: boolean("available").notNull(),
    clientId: uuid("client_id").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("reports_idempotency_key_unique").on(table.idempotencyKey),
    index("reports_bathroom_created_at_idx").on(
      table.building,
      table.floor,
      table.category,
      table.createdAt,
    ),
    index("reports_client_created_at_idx").on(table.clientId, table.createdAt),
  ],
);
