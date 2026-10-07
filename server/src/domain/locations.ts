export const CONFIRMED_HH5_LOCATION = {
  id: "HH5",
  latitude: 51.907327,
  longitude: -8.513503,
  radiusMeters: 500,
} as const;

export const LOCATION_AUTHORIZATION_SECONDS = 4 * 60 * 60;

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type LocationReading = Coordinates & {
  accuracy: number;
};

export type LocationConfiguration = Coordinates & {
  id: string;
  radiusMeters: number;
  maxAccuracyMeters: number;
};

export type LocationAuthorizationDecision =
  | { authorized: true; distanceMeters: number }
  | {
      authorized: false;
      reason:
        | "INVALID_INPUT"
        | "INSUFFICIENT_ACCURACY"
        | "OUTSIDE_ALLOWED_AREA";
    };

export type LocationAuthorizationWindow = {
  verifiedAt: Date;
  expiresAt: Date;
};

const EARTH_RADIUS_METERS = 6_371_008.8;

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMeters(from: Coordinates, to: Coordinates) {
  const latitudeDelta = degreesToRadians(to.latitude - from.latitude);
  const longitudeDelta = degreesToRadians(to.longitude - from.longitude);
  const fromLatitude = degreesToRadians(from.latitude);
  const toLatitude = degreesToRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

export function authorizeLocation(
  location: LocationConfiguration,
  reading: LocationReading,
): LocationAuthorizationDecision {
  if (
    !Number.isFinite(reading.latitude) ||
    reading.latitude < -90 ||
    reading.latitude > 90 ||
    !Number.isFinite(reading.longitude) ||
    reading.longitude < -180 ||
    reading.longitude > 180 ||
    !Number.isFinite(reading.accuracy) ||
    reading.accuracy <= 0
  ) {
    return { authorized: false, reason: "INVALID_INPUT" };
  }

  if (reading.accuracy > location.maxAccuracyMeters) {
    return { authorized: false, reason: "INSUFFICIENT_ACCURACY" };
  }

  const distance = distanceMeters(location, reading);
  // Keep the configured boundary inclusive despite sub-micrometer floating-point drift.
  if (distance - location.radiusMeters > 1e-6) {
    return { authorized: false, reason: "OUTSIDE_ALLOWED_AREA" };
  }

  return { authorized: true, distanceMeters: distance };
}

export function authorizationWindow(
  verifiedAt: Date,
): LocationAuthorizationWindow {
  return {
    verifiedAt,
    expiresAt: new Date(
      verifiedAt.getTime() + LOCATION_AUTHORIZATION_SECONDS * 1000,
    ),
  };
}

export function isAuthorizationValid(
  authorization: LocationAuthorizationWindow,
  now: Date,
) {
  return authorization.expiresAt.getTime() > now.getTime();
}
