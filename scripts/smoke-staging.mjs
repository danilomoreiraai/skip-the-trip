import { randomUUID } from "node:crypto";

const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://localhost:8080/api").replace(
  /\/$/,
  "",
);
const bathroom = { building: "HH5", floor: "3", category: "Accessible" };

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log(`Smoke testing ${baseUrl}`);
const health = await request("/health/ready");
assert(health.status === "ready", "API readiness probe did not return ready");

const query = new URLSearchParams(bathroom);
const before = await request(`/reports?${query}`);
const vote = {
  ...bathroom,
  available: true,
  clientId: randomUUID(),
  idempotencyKey: randomUUID(),
};
const created = await request("/reports", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(vote),
});
assert(created.available === true, "Created vote was not returned as latest");
assert(created.yesCount === before.yesCount + 1, "YES count did not increment");

const retried = await request("/reports", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(vote),
});
assert(retried.yesCount === created.yesCount, "Idempotent retry changed YES count");
assert(retried.noCount === created.noCount, "Idempotent retry changed NO count");

const readBack = await request(`/reports?${query}`);
assert(readBack.available === true, "Read-after-write did not return the vote");
assert(readBack.yesCount === created.yesCount, "Read-after-write count differs");

console.log("Smoke test passed: readiness, read/write and idempotency are healthy.");
