import { type Bathroom, bathroomSchema } from "../domain/bathroom";

const FAVORITE_KEY = "skip-the-trip:favorite:v1";
const VIEW_KEY = "skip-the-trip:view:v1";
export type View = "overview" | "contribute";
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
    /* Use the capability default. */
  }
  return window.matchMedia("(pointer: coarse)").matches &&
    window.matchMedia("(max-width: 900px)").matches
    ? "contribute"
    : "overview";
}
export function saveView(value: View) {
  try {
    localStorage.setItem(VIEW_KEY, value);
  } catch {
    /* Keep the current in-memory choice. */
  }
}
