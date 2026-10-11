import { describe, expect, it } from "vitest";
import { isWithinNotificationWindow } from "./notification-window.js";

describe("operational notification window", () => {
  it("allows weekday notifications from 06:00 until just before 18:00", () => {
    expect(
      isWithinNotificationWindow(new Date("2026-10-12T05:00:00.000Z")),
    ).toBe(true);
    expect(
      isWithinNotificationWindow(new Date("2026-10-12T16:59:00.000Z")),
    ).toBe(true);
  });

  it("suppresses weekday notifications before 06:00 and from 18:00", () => {
    expect(
      isWithinNotificationWindow(new Date("2026-10-12T04:59:00.000Z")),
    ).toBe(false);
    expect(
      isWithinNotificationWindow(new Date("2026-10-12T17:00:00.000Z")),
    ).toBe(false);
  });

  it("suppresses weekend notifications", () => {
    expect(
      isWithinNotificationWindow(new Date("2026-10-10T09:00:00.000Z")),
    ).toBe(false);
    expect(
      isWithinNotificationWindow(new Date("2026-10-11T09:00:00.000Z")),
    ).toBe(false);
  });

  it("uses Dublin local time after the daylight-saving transition", () => {
    expect(
      isWithinNotificationWindow(new Date("2026-10-26T06:00:00.000Z")),
    ).toBe(true);
    expect(
      isWithinNotificationWindow(new Date("2026-10-26T18:00:00.000Z")),
    ).toBe(false);
  });
});
