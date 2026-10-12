import { and, eq, gt, lte, sql } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { locationAuthorizations } from "../../db/schema.js";
import type { LocationAuthorizationWindow } from "../../domain/locations.js";
import { traceDatabaseOperation } from "../../observability/tracing.js";

export type LocationAuthorizationsRepository = {
  findValid(
    anonymousId: string,
    locationId: string,
    now: Date,
  ): Promise<LocationAuthorizationWindow | null>;
  authorize(
    anonymousId: string,
    locationId: string,
    window: LocationAuthorizationWindow,
    now: Date,
  ): Promise<LocationAuthorizationWindow>;
  deleteExpired(before: Date): Promise<number>;
};

export function createLocationAuthorizationsRepository(
  db: Database,
): LocationAuthorizationsRepository {
  return {
    async findValid(anonymousId, locationId, now) {
      const row = await traceDatabaseOperation(
        "location_authorizations.read",
        () =>
          db.query.locationAuthorizations.findFirst({
            where: and(
              eq(locationAuthorizations.anonymousId, anonymousId),
              eq(locationAuthorizations.locationId, locationId),
              gt(locationAuthorizations.expiresAt, now),
            ),
          }),
      );
      return row
        ? { verifiedAt: row.verifiedAt, expiresAt: row.expiresAt }
        : null;
    },
    async authorize(anonymousId, locationId, window, now) {
      return traceDatabaseOperation("location_authorizations.authorize", () =>
        db.transaction(async (tx) => {
          const lockKey = `${anonymousId}:${locationId}`;
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`,
          );
          const current = await tx.query.locationAuthorizations.findFirst({
            where: and(
              eq(locationAuthorizations.anonymousId, anonymousId),
              eq(locationAuthorizations.locationId, locationId),
              gt(locationAuthorizations.expiresAt, now),
            ),
          });
          if (current)
            return {
              verifiedAt: current.verifiedAt,
              expiresAt: current.expiresAt,
            };
          const [saved] = await tx
            .insert(locationAuthorizations)
            .values({ anonymousId, locationId, ...window })
            .onConflictDoUpdate({
              target: [
                locationAuthorizations.anonymousId,
                locationAuthorizations.locationId,
              ],
              set: window,
            })
            .returning();
          if (!saved) throw new Error("Location authorization was not saved");
          return { verifiedAt: saved.verifiedAt, expiresAt: saved.expiresAt };
        }),
      );
    },
    async deleteExpired(before) {
      const deleted = await traceDatabaseOperation(
        "location_authorizations.delete_expired",
        () =>
          db
            .delete(locationAuthorizations)
            .where(lte(locationAuthorizations.expiresAt, before))
            .returning({ anonymousId: locationAuthorizations.anonymousId }),
      );
      return deleted.length;
    },
  };
}
