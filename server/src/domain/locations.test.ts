import { describe, expect, it } from "vitest";
import {
  authorizationWindow,
  authorizeLocation,
  CONFIRMED_HH5_LOCATION,
  distanceMeters,
  isAuthorizationValid,
  LOCATION_AUTHORIZATION_SECONDS,
} from "./locations.js";

describe("location authorization", () => {
  it("uses the confirmed HH5 server configuration", () => {
    expect(CONFIRMED_HH5_LOCATION).toEqual({
      id: "HH5",
      latitude: 51.907327,
      longitude: -8.513503,
      radiusMeters: 500,
    });
    expect(LOCATION_AUTHORIZATION_SECONDS).toBe(14_400);
  });

  it("calculates geodesic distance in meters", () => {
    expect(
      distanceMeters(
        { latitude: 51.907327, longitude: -8.513503 },
        { latitude: 51.911823601818625, longitude: -8.513503 },
      ),
    ).toBeCloseTo(500, 0);
  });

  it.each([
    [51.91181460861499, true], // 499 m north
    [51.911823601818625, true], // 500 m north, inclusive boundary
    [51.91183259502226, false], // 501 m north
  ])("applies the configured radius at latitude %s", (latitude, authorized) => {
    expect(
      authorizeLocation(
        { ...CONFIRMED_HH5_LOCATION, maxAccuracyMeters: 100 },
        {
          latitude,
          longitude: -8.513503,
          accuracy: 20,
        },
      ).authorized,
    ).toBe(authorized);
  });

  it("rejects insufficient accuracy without widening the radius", () => {
    expect(
      authorizeLocation(
        { ...CONFIRMED_HH5_LOCATION, maxAccuracyMeters: 100 },
        {
          latitude: 51.907327,
          longitude: -8.513503,
          accuracy: 101,
        },
      ),
    ).toEqual({ authorized: false, reason: "INSUFFICIENT_ACCURACY" });
  });

  it("creates a fixed four-hour authorization window from server time", () => {
    const verifiedAt = new Date("2026-10-06T20:00:00.000Z");

    expect(authorizationWindow(verifiedAt)).toEqual({
      verifiedAt,
      expiresAt: new Date("2026-10-07T00:00:00.000Z"),
    });
  });

  it("treats the authorization as expired at the exact expiry instant", () => {
    const authorization = authorizationWindow(
      new Date("2026-10-06T20:00:00.000Z"),
    );

    expect(
      isAuthorizationValid(authorization, new Date("2026-10-06T23:59:59.999Z")),
    ).toBe(true);
    expect(
      isAuthorizationValid(authorization, new Date("2026-10-07T00:00:00.000Z")),
    ).toBe(false);
  });

  it.each([
    { latitude: Number.NaN, longitude: -8.513503, accuracy: 10 },
    { latitude: 91, longitude: -8.513503, accuracy: 10 },
    { latitude: 51.907327, longitude: -181, accuracy: 10 },
    { latitude: 51.907327, longitude: -8.513503, accuracy: 0 },
  ])(
    "rejects invalid coordinates and accuracy: $latitude, $longitude, $accuracy",
    (reading) => {
      expect(
        authorizeLocation(
          { ...CONFIRMED_HH5_LOCATION, maxAccuracyMeters: 100 },
          reading,
        ),
      ).toEqual({
        authorized: false,
        reason: "INVALID_INPUT",
      });
    },
  );
});
