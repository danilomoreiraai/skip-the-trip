import { setTimeout } from "node:timers/promises";
import { db, pool } from "../db/index.js";
import { env } from "../env.js";
import { createPushSender } from "../lib/push-sender.js";
import { createPushRepository } from "../modules/push/repository.js";

const shutdown = new AbortController();
process.once("SIGINT", () => shutdown.abort());
process.once("SIGTERM", () => shutdown.abort());
try {
  const repository = createPushRepository(db, env.PUSH_ENCRYPTION_KEY);
  const send = env.PUSH_ENABLED
    ? createPushSender({
        subject: env.VAPID_SUBJECT,
        publicKey: env.VAPID_PUBLIC_KEY!,
        privateKey: env.VAPID_PRIVATE_KEY!,
      })
    : null;
  while (!shutdown.signal.aborted) {
    if (send) {
      try {
        const result = await repository.drain(send);
        if (result.sent || result.retried || result.discarded)
          console.log(JSON.stringify({ event: "push.batch", ...result }));
      } catch {
        console.error(JSON.stringify({ event: "push.batch_failed" }));
      }
    }
    await setTimeout(2_000, undefined, { signal: shutdown.signal }).catch(
      () => {},
    );
  }
} finally {
  await pool.end();
}
