const prometheusUrl = process.env.PROMETHEUS_URL ?? "http://localhost:9090";
const grafanaUrl = process.env.GRAFANA_URL ?? "http://localhost:3000";
const grafanaPassword =
  process.env.GRAFANA_ADMIN_PASSWORD ?? "local-grafana-5kM8pR2vN7xQ4tC6";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(url, init) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

console.log(`Smoke testing Prometheus at ${prometheusUrl}`);
const targets = await json(`${prometheusUrl}/api/v1/targets`);
const apiTarget = targets.data.activeTargets.find(
  (target) => target.labels.job === "skip-the-trip-api",
);
assert(apiTarget?.health === "up", "Prometheus API target is not healthy");

const rules = await json(`${prometheusUrl}/api/v1/rules?type=alert`);
const alertNames = rules.data.groups.flatMap((group) =>
  group.rules.map((rule) => rule.name),
);
for (const expected of [
  "SkipTheTripApiDown",
  "SkipTheTripHighErrorRate",
  "SkipTheTripHighLatency",
  "SkipTheTripDatabaseUnavailable",
  "SkipTheTripMetricsMissing",
]) {
  assert(alertNames.includes(expected), `Missing Prometheus alert: ${expected}`);
}

console.log(`Smoke testing Grafana at ${grafanaUrl}`);
const authorization = `Basic ${Buffer.from(`admin:${grafanaPassword}`).toString("base64")}`;
const grafanaHealth = await json(`${grafanaUrl}/api/health`);
assert(grafanaHealth.database === "ok", "Grafana database is not healthy");
const dataSource = await json(`${grafanaUrl}/api/datasources/uid/prometheus`, {
  headers: { Authorization: authorization },
});
assert(dataSource.url === "http://prometheus:9090", "Grafana Prometheus data source is incorrect");
const dashboards = await json(
  `${grafanaUrl}/api/search?query=${encodeURIComponent("Skip The Trip API Overview")}`,
  { headers: { Authorization: authorization } },
);
assert(
  dashboards.some((dashboard) => dashboard.uid === "skip-the-trip-api"),
  "Provisioned Grafana dashboard was not found",
);

console.log("Monitoring smoke test passed: target, alerts, data source and dashboard are healthy.");
