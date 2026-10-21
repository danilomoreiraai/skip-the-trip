export function storageKey(key: string, base = import.meta.env.BASE_URL) {
  return base === "/" ? key : `${key}:${base}`;
}
