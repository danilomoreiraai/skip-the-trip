export function parseLatestBackup(xml: string): Date | null {
  const timestamps = [...xml.matchAll(/<LastModified>([^<]+)<\/LastModified>/g)]
    .map((match) => match[1])
    .filter((value): value is string => value !== undefined)
    .map((value) => new Date(value))
    .filter((date) => Number.isFinite(date.getTime()));
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps.map((date) => date.getTime())));
}

export function backupIsStale(
  latest: Date | null,
  now: Date,
  maxAgeHours: number,
) {
  return !latest || now.getTime() - latest.getTime() > maxAgeHours * 3_600_000;
}
