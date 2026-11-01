#!/usr/bin/env node
// Read-only daily health check for skipthetrip.info (root/beta and /teste2_0).
// Never writes data: no votes, no location verification. Zero dependencies.
// Usage: node scripts/health-check.mjs [--out health.json]
// Exit code: 0 = all ok, 1 = at least one failure, 2 = script error.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { connect } from "node:tls";

const HOST = process.env.HEALTH_HOST ?? "skipthetrip.info";
const REPO = process.env.HEALTH_REPO ?? "danilomoreiraai/skip-the-trip";
const SLOW_MS = Number(process.env.HEALTH_SLOW_MS ?? 2000);
const SSL_MIN_DAYS = Number(process.env.HEALTH_SSL_MIN_DAYS ?? 14);
const outIndex = process.argv.indexOf("--out");
const outFile = outIndex > -1 ? process.argv[outIndex + 1] : null;

const targets = [
  {
    name: "root",
    base: `https://${HOST}`,
    pages: ["/", "/HH5", "/privacy"],
    // Root runs a pinned pre-HH5 commit: `available` may be null.
    reportsPath: "/api/reports?building=HH5&floor=3&category=Accessible",
    allowNullAvailable: true,
    statusPath: null,
    branch: "main",
  },
  {
    name: "v2",
    base: `https://${HOST}/teste2_0`,
    pages: ["/"],
    reportsPath: "/api/reports?building=HH5&floor=3&category=Accessible",
    allowNullAvailable: false,
    statusPath: "/api/locations/HH5/status",
    branch: "codex/v2.0-tests",
  },
];

const checks = [];
const record = (target, check, ok, detail, extra = {}) =>
  checks.push({ target, check, ok, ...(ok ? {} : { detail }), ...extra });

async function timedFetch(url) {
  const start = performance.now();
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": "stt-health-check/1" },
  });
  const body = await response.text();
  return { response, body, ms: Math.round(performance.now() - start) };
}

async function check(target, name, url, validate) {
  try {
    const { response, body, ms } = await timedFetch(url);
    if (!response.ok) return record(target, name, false, `HTTP ${response.status} em ${url}: ${body.slice(0, 200)}`, { ms });
    const problem = validate ? validate(body, response) : null;
    if (problem) return record(target, name, false, `${problem} (${url})`, { ms });
    if (ms > SLOW_MS) return record(target, name, false, `lento: ${ms}ms > ${SLOW_MS}ms (${url})`, { ms });
    record(target, name, true, null, { ms });
    return body;
  } catch (error) {
    record(target, name, false, `${error.name}: ${error.message} (${url})`);
  }
}

const parseJson = (body) => {
  try { return JSON.parse(body); } catch { return undefined; }
};

const summaryProblem = (json, allowNull) => {
  if (!json) return "JSON inválido";
  for (const key of ["building", "floor", "category", "yesCount", "noCount"]) {
    if (!(key in json)) return `campo ausente: ${key}`;
  }
  const okAvailable = typeof json.available === "boolean" || (allowNull && json.available === null);
  return okAvailable ? null : `available inválido: ${JSON.stringify(json.available)}`;
};

async function checkTarget(t) {
  for (const page of t.pages) {
    const html = await check(t.name, `page ${page}`, `${t.base}${page}`, (body) =>
      body.includes('id="root"') ? null : 'HTML sem <div id="root">',
    );
    if (page === "/" && typeof html === "string") {
      const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1]);
      if (assets.length === 0) record(t.name, "assets", false, "nenhum JS/CSS referenciado no HTML");
      for (const asset of assets) {
        await check(t.name, `asset ${asset}`, new URL(asset, `https://${HOST}`).href);
      }
    }
  }
  await check(t.name, "health/live", `${t.base}/api/health/live`, (b) =>
    parseJson(b)?.status === "ok" ? null : `resposta inesperada: ${b.slice(0, 100)}`,
  );
  await check(t.name, "health/ready", `${t.base}/api/health/ready`, (b) =>
    parseJson(b)?.status === "ready" ? null : `não está ready: ${b.slice(0, 100)}`,
  );
  const apiRelease = parseJson(await check(t.name, "api/release", `${t.base}/api/release`, (b) =>
    /^[0-9a-f]{40}$/.test(parseJson(b)?.revision ?? "") ? null : "revision inválida",
  ) ?? "");
  const webRelease = parseJson(await check(t.name, "web/release.json", `${t.base}/release.json`, (b) =>
    /^[0-9a-f]{40}$/.test(parseJson(b)?.revision ?? "") ? null : "revision inválida",
  ) ?? "");
  if (apiRelease && webRelease) {
    const same = apiRelease.revision === webRelease.revision;
    record(t.name, "release consistente", same, `API ${apiRelease.revision} ≠ web ${webRelease.revision}`, {
      revision: apiRelease.revision,
    });
  }
  await check(t.name, "api/reports", `${t.base}${t.reportsPath}`, (b) =>
    summaryProblem(parseJson(b), t.allowNullAvailable),
  );
  await check(t.name, "api/eligibility", `${t.base}/api/locations/HH5/eligibility`, (b) =>
    typeof parseJson(b)?.authorized === "boolean" ? null : "authorized ausente",
  );
  if (t.statusPath) {
    await check(t.name, "api/status", `${t.base}${t.statusPath}`, (b) => {
      const json = parseJson(b);
      if (!Array.isArray(json?.bathrooms) || json.bathrooms.length === 0) return "bathrooms vazio";
      return json.bathrooms.map((s) => summaryProblem(s, false)).find(Boolean) ?? null;
    });
  }
}

function checkSsl() {
  return new Promise((resolve) => {
    const socket = connect({ host: HOST, port: 443, servername: HOST, timeout: 10_000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      const days = Math.floor((new Date(cert.valid_to) - Date.now()) / 86_400_000);
      record("infra", "ssl", days >= SSL_MIN_DAYS, `certificado expira em ${days} dias`, { days });
      resolve();
    });
    socket.on("error", (e) => { record("infra", "ssl", false, e.message); resolve(); });
    socket.on("timeout", () => { record("infra", "ssl", false, "timeout TLS"); socket.destroy(); resolve(); });
  });
}

function gh(args) {
  return JSON.parse(execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
}

function checkGithub() {
  try {
    execFileSync("gh", ["--version"], { stdio: "ignore" });
  } catch {
    record("github", "gh", false, "gh CLI indisponível: checagens do GitHub puladas", { skipped: true });
    return;
  }
  for (const t of targets) {
    try {
      const [run] = gh(["run", "list", "-R", REPO, "-b", t.branch, "-w", "Quality", "-L", "1",
        "--json", "conclusion,status,url,headSha,createdAt"]);
      if (!run) { record("github", `CI ${t.branch}`, true, null, { note: "sem execuções" }); continue; }
      const ok = run.status !== "completed" || run.conclusion === "success";
      record("github", `CI ${t.branch}`, ok, `último Quality: ${run.conclusion} ${run.url}`, { sha: run.headSha?.slice(0, 8) });
    } catch (e) {
      record("github", `CI ${t.branch}`, false, `erro gh: ${e.message.split("\n")[0]}`);
    }
  }
  try {
    const alerts = gh(["api", `repos/${REPO}/dependabot/alerts?state=open&per_page=100`]);
    const serious = alerts.filter((a) => ["critical", "high"].includes(a.security_advisory?.severity));
    record("github", "dependabot alerts", serious.length === 0,
      serious.slice(0, 5).map((a) => `${a.security_advisory.severity} ${a.dependency?.package?.name} (${a.dependency?.manifest_path})`).join("; "),
      { open: alerts.length, highOrCritical: serious.length });
  } catch (e) {
    record("github", "dependabot alerts", true, null, { skipped: true, note: e.message.split("\n")[0] });
  }
}

try {
  for (const t of targets) await checkTarget(t);
  await checkSsl();
  checkGithub();
  const failures = checks.filter((c) => !c.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    host: HOST,
    ok: failures.length === 0,
    total: checks.length,
    failed: failures.length,
    failures,
    revisions: Object.fromEntries(checks.filter((c) => c.revision).map((c) => [c.target, c.revision])),
    sslDays: checks.find((c) => c.check === "ssl")?.days,
    slowestMs: Math.max(0, ...checks.map((c) => c.ms ?? 0)),
  };
  const json = JSON.stringify(report, null, 2);
  if (outFile) writeFileSync(outFile, json);
  console.log(json);
  process.exit(report.ok ? 0 : 1);
} catch (error) {
  console.error(`health-check falhou: ${error.stack}`);
  process.exit(2);
}
