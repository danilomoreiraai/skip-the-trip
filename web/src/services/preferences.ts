import { type Bathroom, bathroomSchema } from "../domain/bathroom";
import { storageKey } from "../lib/storage-key";

const FAVORITE_KEY = storageKey("skip-the-trip:favorite:v1");
const VIEW_KEY = storageKey("skip-the-trip:view:v1");
const DEVICE_KEY = storageKey("skip-the-trip:device:v1");
export type View = "overview" | "contribute";
export type Device = "mobile" | "mac";
export function loadDevice(): Device | null {
  try {
    const value = sessionStorage.getItem(DEVICE_KEY);
    return value === "mobile" || value === "mac" ? value : null;
  } catch {
    return null;
  }
}
export function saveDevice(value: Device | null) {
  try {
    if (value) sessionStorage.setItem(DEVICE_KEY, value);
    else sessionStorage.removeItem(DEVICE_KEY);
  } catch {
    /* Keep the current in-memory choice. */
  }
}
export function loadFavorite(
  fallback: Bathroom | null = null,
): Bathroom | null {
  try {
    const parsed = bathroomSchema.safeParse(
      JSON.parse(localStorage.getItem(FAVORITE_KEY) ?? "null"),
    );
    return parsed.success && parsed.data.building === "HH5"
      ? parsed.data
      : null;
  } catch {
    return fallback;
  }
}
export function saveFavorite(value: Bathroom | null) {
  try {
    if (value)
      localStorage.setItem(
        FAVORITE_KEY,
        JSON.stringify(bathroomSchema.parse(value)),
      );
    else localStorage.removeItem(FAVORITE_KEY);
  } catch {
    /* Preferences must not block consultation. */
  }
}
export function loadView(): View {
  try {
    const value = localStorage.getItem(VIEW_KEY);
    if (value === "overview" || value === "contribute") return value;
  } catch {
    /* Keep consultation available without storage. */
  }
  return "overview";
}
export function saveView(value: View) {
  try {
    localStorage.setItem(VIEW_KEY, value);
  } catch {
    /* Keep the current in-memory choice. */
  }
}
