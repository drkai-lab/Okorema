import { GEOFENCE_RADII, type GeofenceRadius } from "./types";

export type LatLng = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_M = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function sortPlacesByDistance<T extends LatLng>(origin: LatLng, places: T[]): T[] {
  return [...places].sort((a, b) => haversineMeters(origin, a) - haversineMeters(origin, b));
}

export function isAllowedRadius(value: number): value is GeofenceRadius {
  return (GEOFENCE_RADII as readonly number[]).includes(value);
}
