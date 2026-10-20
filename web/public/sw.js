/* Push-only worker. Live API responses and votes are never cached or replayed. */
const api = new URL(new URL(self.location.href).searchParams.get("api") || "/api", self.location.origin);
const local = new URL(self.location.href).hostname === "127.0.0.1" || new URL(self.location.href).hostname === "localhost";
if (api.origin !== self.location.origin && !local) throw new Error("Push API must use the application origin");
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
async function claim(cycleId, tag) {
  try {
    return await new Promise((resolve, reject) => {
      const open = indexedDB.open("skip-the-trip-push", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("seen");
      open.onerror = () => reject(new Error("Push deduplication unavailable"));
      open.onblocked = () => reject(new Error("Push deduplication blocked"));
      open.onsuccess = () => {
        const db = open.result;
        const transaction = db.transaction("seen", "readwrite");
        const store = transaction.objectStore("seen");
        let claimed = false;
        const existing = store.get(cycleId);
        existing.onsuccess = () => { if (existing.result === undefined) { store.put(Date.now(), cycleId); claimed = true; } };
        const cursor = store.openCursor();
        cursor.onsuccess = () => { const row = cursor.result; if (row) { if (row.value < Date.now() - 86400000) row.delete(); row.continue(); } };
        transaction.oncomplete = () => { db.close(); resolve(claimed); };
        transaction.onerror = () => { db.close(); reject(new Error("Push deduplication unavailable")); };
        transaction.onabort = () => { db.close(); reject(new Error("Push deduplication unavailable")); };
      };
    });
  } catch { return (await self.registration.getNotifications({ tag })).length === 0; }
}
self.addEventListener("push", event => event.waitUntil((async () => {
  try {
    const data = event.data?.json();
    if (!data || data.type !== "cleaning-started" || data.building !== "HH5" || !["G", "1", "2", "3"].includes(data.floor) || !["Male", "Accessible", "Female"].includes(data.category) || !/^[0-9a-f-]{36}$/.test(data.cycleId) || !Number.isFinite(Date.parse(data.issuedAt)) || Date.now() - Date.parse(data.issuedAt) >= 60000 || Date.parse(data.issuedAt) > Date.now() + 60000) return;
    const root = api.href.replace(/\/$/, "");
    const [statusResponse, preferenceResponse] = await Promise.all([fetch(`${root}/locations/HH5/status`, { cache: "no-store", credentials: "omit" }), fetch(`${root}/push/subscription`, { cache: "no-store", credentials: "include" })]);
    if (!statusResponse.ok || !preferenceResponse.ok) return;
    const [status, preference] = await Promise.all([statusResponse.json(), preferenceResponse.json()]);
    const chosen = preference.bathroom;
    if (!preference.subscribed || !chosen || chosen.building !== data.building || chosen.floor !== data.floor || chosen.category !== data.category) return;
    const current = status.cleaning?.find(value => value.id === data.cycleId && value.state === "active" && !value.endedAt);
    if (!current || Date.parse(current.expectedEndAt) <= Date.parse(status.generatedAt)) return;
    const tag = `cleaning-${data.cycleId}`;
    if (!await claim(data.cycleId, tag)) return;
    const url = `/HH5?floor=${encodeURIComponent(data.floor)}&category=${encodeURIComponent(data.category)}`;
    await self.registration.showNotification("Cleaning reported by the team", { body: `HH5 · Floor ${data.floor} · ${data.category}. Check the app for the latest status.`, tag, renotify: false, icon: "/favicon.svg", data: { url } });
  } catch { /* Failed or unverifiable messages are discarded without exposing credentials. */ }
})()));
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL(event.notification.data?.url || "/HH5", self.location.origin);
    if (url.origin !== self.location.origin || url.pathname !== "/HH5") return;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === url.origin);
    if (existing) { await existing.navigate(url.href); await existing.focus(); }
    else await self.clients.openWindow(url.href);
  })());
});
