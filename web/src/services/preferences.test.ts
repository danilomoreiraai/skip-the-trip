import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadDevice,
  loadFavorite,
  loadView,
  saveDevice,
  saveFavorite,
  saveView,
} from "./preferences";
import { saveSelection } from "./reports";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  const session = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => session.set(key, value),
    removeItem: (key: string) => session.delete(key),
  });
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
});
afterEach(() => vi.unstubAllGlobals());
describe("explicit browser preferences", () => {
  it("does not infer a contribution choice from screen or touch capabilities", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    expect(loadView()).toBe("overview");
    vi.stubGlobal("window", {
      matchMedia: (query: string) => ({ matches: query.includes("pointer") }),
    });
    expect(loadView()).toBe("overview");
  });
  it("requires an explicit device choice and remembers changes only in the current session", () => {
    expect(loadDevice()).toBeNull();
    saveDevice("mac");
    expect(loadDevice()).toBe("mac");
    saveDevice("mobile");
    expect(loadDevice()).toBe("mobile");
    saveDevice(null);
    expect(loadDevice()).toBeNull();
    expect(localStorage.getItem("skip-the-trip:device:v1")).toBeNull();
  });
  it("returns to device choice for invalid session data and tolerates blocked storage", () => {
    sessionStorage.setItem("skip-the-trip:device:v1", "desktop");
    expect(loadDevice()).toBeNull();
    vi.stubGlobal("sessionStorage", {
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
    expect(loadDevice()).toBeNull();
    expect(() => saveDevice("mac")).not.toThrow();
    expect(() => saveDevice(null)).not.toThrow();
  });
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
    const current = { building: "HH5", floor: "G", category: "Male" } as const;
    expect(loadFavorite(current)).toEqual(current);
    expect(() => saveFavorite(null)).not.toThrow();
    expect(() => saveView("overview")).not.toThrow();
  });
});
