export type LatLng = { lat: number; lng: number };

export const CITY_CENTER: LatLng = { lat: 48.7784, lng: 9.1794 };

const MPD_LAT = 110574;
const MPD_LNG = 111320 * Math.cos((CITY_CENTER.lat * Math.PI) / 180);

/** Project lat/lng to local metres, origin at the city centre. x east, y south. */
export function project(p: LatLng): { x: number; y: number } {
  return {
    x: (p.lng - CITY_CENTER.lng) * MPD_LNG,
    y: -(p.lat - CITY_CENTER.lat) * MPD_LAT,
  };
}

export function unproject(x: number, y: number): LatLng {
  return {
    lng: CITY_CENTER.lng + x / MPD_LNG,
    lat: CITY_CENTER.lat - y / MPD_LAT,
  };
}

export function distanceM(a: LatLng, b: LatLng): number {
  const pa = project(a);
  const pb = project(b);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

export function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

export type Place = {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
};

export const PLACES: Place[] = [
  { id: "hbf", name: "Hauptbahnhof", district: "Mitte", lat: 48.7838, lng: 9.1817 },
  { id: "schlossplatz", name: "Schlossplatz", district: "Mitte", lat: 48.7784, lng: 9.1794 },
  { id: "marienplatz", name: "Marienplatz", district: "Süd", lat: 48.7636, lng: 9.1662 },
  { id: "feuersee", name: "Feuersee", district: "West", lat: 48.7728, lng: 9.1663 },
  { id: "killesberg", name: "Killesberg", district: "Nord", lat: 48.7955, lng: 9.165 },
  { id: "pragsattel", name: "Pragsattel", district: "Nord", lat: 48.802, lng: 9.177 },
  { id: "cannstatt", name: "Bad Cannstatt Wilhelmsplatz", district: "Bad Cannstatt", lat: 48.8035, lng: 9.2153 },
  { id: "wilhelma", name: "Wilhelma", district: "Bad Cannstatt", lat: 48.8045, lng: 9.203 },
  { id: "arena", name: "MHP Arena", district: "Neckarpark", lat: 48.7925, lng: 9.232 },
  { id: "ostendplatz", name: "Ostendplatz", district: "Ost", lat: 48.786, lng: 9.2049 },
  { id: "degerloch", name: "Degerloch", district: "Degerloch", lat: 48.748, lng: 9.169 },
  { id: "moehringen", name: "Möhringen", district: "Möhringen", lat: 48.728, lng: 9.147 },
  { id: "vaihingen", name: "Vaihingen Bahnhof", district: "Vaihingen", lat: 48.728, lng: 9.113 },
  { id: "uni", name: "Universität", district: "Vaihingen", lat: 48.7456, lng: 9.1064 },
  { id: "flughafen", name: "Flughafen / Messe", district: "Echterdingen", lat: 48.6899, lng: 9.193 },
  { id: "heslach", name: "Heslach Vogelrain", district: "Süd", lat: 48.758, lng: 9.152 },
  { id: "zuffenhausen", name: "Zuffenhausen", district: "Zuffenhausen", lat: 48.832, lng: 9.169 },
  { id: "weilimdorf", name: "Weilimdorf", district: "Weilimdorf", lat: 48.82, lng: 9.118 },
];

export function placeById(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id);
}
