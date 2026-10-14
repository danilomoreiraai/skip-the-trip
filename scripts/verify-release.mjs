const revision = process.env.APP_REVISION;
const baseUrl = process.env.VERIFY_BASE_URL?.replace(/\/$/, "");

if (!revision || !/^[0-9a-f]{40}$/.test(revision) || !baseUrl) {
  throw new Error("Set APP_REVISION to the approved SHA and VERIFY_BASE_URL to the public origin");
}

async function get(path) {
  const response = await fetch(new URL(path, `${baseUrl}/`), {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

const [web, api, webLive, apiLive, apiReady] = await Promise.all([
  get("release.json"),
  get("api/release"),
  fetch(new URL("health/live", `${baseUrl}/`), { signal: AbortSignal.timeout(10_000) }),
  get("api/health/live"),
  get("api/health/ready"),
]);

for (const [name, payload] of [["web", web], ["API", api]]) {
  if (Object.keys(payload).length !== 1 || payload.revision !== revision) {
    throw new Error(`${name} revision does not match the approved source`);
  }
}
if (!webLive.ok || (await webLive.text()).trim() !== "ok") {
  throw new Error("Web liveness probe failed");
}
if (apiLive.status !== "ok" || apiReady.status !== "ready") {
  throw new Error("API health probe failed");
}

console.log(`Release ${revision}: web, API and health checks passed.`);
