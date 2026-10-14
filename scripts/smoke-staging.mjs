import { randomUUID } from "node:crypto";

const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://localhost:8080/api").replace(
  /\/$/,
  "",
);
const bathroom = { building: "HH5", floor: "3", category: "Accessible" };
const testLocation = {
  latitude: Number(process.env.SMOKE_LOCATION_LATITUDE ?? "51.907327"),
  longitude: Number(process.env.SMOKE_LOCATION_LONGITUDE ?? "-8.513503"),
  accuracy: Number(process.env.SMOKE_LOCATION_ACCURACY ?? "20"),
};
let cookie;

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(cookie ? { Cookie: cookie } : {}), ...init?.headers },
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json();
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";", 1)[0];
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
const expectedRevision = process.env.APP_REVISION ?? "local";
assert(/^(?:[0-9a-f]{40}|local)$/.test(expectedRevision), "Expected a full Git SHA or local revision");
const apiRelease = await request("/release");
const webReleaseResponse = await fetch(new URL("../release.json", `${baseUrl}/`), {
  signal: AbortSignal.timeout(10_000),
});
assert(webReleaseResponse.ok, "Web release endpoint failed");
const webRelease = await webReleaseResponse.json();
assert(apiRelease.revision === expectedRevision, "API revision differs from the approved source");
assert(webRelease.revision === expectedRevision, "Web revision differs from the approved source");
assert(Object.keys(apiRelease).join() === "revision", "API release includes unexpected fields");
assert(Object.keys(webRelease).join() === "revision", "Web release includes unexpected fields");

const query = new URLSearchParams(bathroom);
const before = await request(`/reports?${query}`);
await request("/locations/HH5/verify-location", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(testLocation),
});
const vote = {
  ...bathroom,
  available: true,
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

console.log("Smoke test passed: readiness, location authorization, read/write and idempotency are healthy.");
