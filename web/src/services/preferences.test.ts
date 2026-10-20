import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFavorite, loadView, saveFavorite, saveView } from "./preferences";
import { saveSelection } from "./reports";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => {} });
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
});
afterEach(() => vi.unstubAllGlobals());
describe("explicit browser preferences", () => {
  it("keeps the favorite independent from incidental selection, replaces and removes it", () => {
    saveFavorite({ building: "HH5", floor: "1", category: "Female" });
    saveSelection({ building: "HH5", floor: "2", category: "Male" });
    expect(loadFavorite()).toEqual({
      building: "HH5",
      floor: "1",
      category: "Female",
    });
    saveFavorite({ building: "HH5", floor: "G", category: "Accessible" });
    expect(loadFavorite()?.category).toBe("Accessible");
    saveFavorite(null);
    expect(loadFavorite()).toBeNull();
  });
  it("chooses consultation for desktop and remembers an explicit contribution choice", () => {
    expect(loadView()).toBe("overview");
    saveView("contribute");
    expect(loadView()).toBe("contribute");
  });
  it("keeps storage failure and malformed preferences from breaking consultation", () => {
    localStorage.setItem("skip-the-trip:favorite:v1", '{"building":"HH1"}');
    expect(loadFavorite()).toBeNull();
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
    });
    expect(loadFavorite()).toBeNull();
    expect(() => saveFavorite(null)).not.toThrow();
    expect(() => saveView("overview")).not.toThrow();
  });
});
