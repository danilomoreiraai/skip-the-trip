import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index.js";

try {
  await migrate(db, { migrationsFolder: "drizzle" });
} finally {
  await pool.end();
}
