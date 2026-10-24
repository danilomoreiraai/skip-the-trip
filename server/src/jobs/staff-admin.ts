import { z } from "zod";
import { db, pool } from "../db/index.js";
import { createOperationsRepository } from "../modules/operations/repository.js";

const operations = createOperationsRepository(db);
try {
  const [command, value] = process.argv.slice(2);
  if (command === "invite" && value) {
    const invite = await operations.issueInvite(value);
    // Deliberate operator-only output: never run this through shared logs or paste it into issues.
    process.stdout.write(
      `${JSON.stringify({ staffId: invite.staffId, inviteCode: invite.code, expiresAt: invite.expiresAt.toISOString() })}\n`,
    );
  } else if (command === "revoke" && value) {
    await operations.revokeMember(z.string().uuid().parse(value));
    process.stdout.write("Staff access revoked.\n");
  } else
    throw new Error(
      "Usage: staff-admin invite <private-alias> | revoke <staff-id>",
    );
} catch {
  process.stderr.write(
    "Staff administration failed. Check the command and private database access.\n",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
