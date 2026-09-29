import { PLACES, type Place } from "./geo";

export function geoPlaceId(lat: number, lng: number, name: string) {
  return `geo:${lat.toFixed(5)},${lng.toFixed(5)},${encodeURIComponent(name)}`;
}

export function makeGeoPlace(lat: number, lng: number, name: string, district = "Stuttgart"): Place {
  return { id: geoPlaceId(lat, lng, name), name, district, lat, lng };
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; street?: string; housenumber?: string; district?: string; city?: string; locality?: string };
};

function featureToPlace(f: PhotonFeature): Place | null {
  const p = f.properties;
  const name = p.name ?? [p.street, p.housenumber].filter(Boolean).join(" ");
  if (!name) return null;
  const [lng, lat] = f.geometry.coordinates;
  return makeGeoPlace(lat, lng, name, p.district ?? p.locality ?? p.city ?? "Stuttgart");
}

/** Address / place autocomplete around Stuttgart (OpenStreetMap geocoder) merged with known places. */
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const term = q.trim().toLowerCase();
  const local = PLACES.filter((p) => !term || `${p.name} ${p.district}`.toLowerCase().includes(term)).slice(0, term ? 3 : 6);
  if (term.length < 3) return local;
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=48.7784&lon=9.1794&limit=6&bbox=8.95,48.62,9.42,48.9`;
    const res = await fetch(url, { signal: signal ?? null });
    const json = (await res.json()) as { features: PhotonFeature[] };
    const remote = json.features.map(featureToPlace).filter((p): p is Place => !!p);
    return [...local, ...remote].slice(0, 7);
  } catch {
    return local;
  }
}

export async function reversePlace(lat: number, lng: number): Promise<Place> {
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`);
    const json = (await res.json()) as { features: PhotonFeature[] };
    const p = json.features[0] && featureToPlace(json.features[0]);
    if (p) return makeGeoPlace(lat, lng, p.name, p.district);
  } catch {
    /* fall through */
  }
  return makeGeoPlace(lat, lng, "Dropped pin");
}
