import * as Location from "expo-location";

import { haversineMeters, sortPlacesByDistance, type LatLng } from "@/domain/geo";
import { isExpoGo } from "@/runtime/expoGo";

export type PlaceHit = LatLng & {
  id: string;
  label: string;
  distanceKm: string;
};

export async function currentCoordinates(): Promise<LatLng | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}

export async function searchPlaces(query: string, origin: LatLng): Promise<PlaceHit[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Okorema/1.0 (local reminder app)",
    },
  });
  if (!response.ok) {
    throw new Error("place-search-failed");
  }
  const rows = (await response.json()) as { place_id: number; display_name: string; lat: string; lon: string }[];
  const places = rows.map((row) => ({
    id: String(row.place_id),
    label: row.display_name,
    latitude: Number(row.lat),
    longitude: Number(row.lon),
  }));
  return sortPlacesByDistance(origin, places).map((place) => ({
    ...place,
    distanceKm: (haversineMeters(origin, place) / 1000).toFixed(1),
  }));
}

export async function syncGeofences(reminders: { id: string; geofence: { latitude: number; longitude: number; radiusMeters: number; trigger: "arrive" | "leave" } | null; deletedAt: string | null; completedAt: string | null }[]): Promise<void> {
  if (isExpoGo()) {
    return;
  }
  const regions = reminders
    .filter((reminder) => reminder.geofence && !reminder.deletedAt && !reminder.completedAt)
    .map((reminder) => ({
      identifier: reminder.id,
      latitude: reminder.geofence!.latitude,
      longitude: reminder.geofence!.longitude,
      radius: reminder.geofence!.radiusMeters,
      notifyOnEnter: reminder.geofence!.trigger === "arrive",
      notifyOnExit: reminder.geofence!.trigger === "leave",
    }));
  const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  if (regions.length === 0) {
    if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK);
    return;
  }
  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) {
    return;
  }
  await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
}

export const GEOFENCE_TASK = "okorema-geofence";
