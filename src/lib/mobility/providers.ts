export type Mode = "walk" | "scooter" | "bike" | "transit" | "ride";

export type Provider = {
  id: string;
  name: string;
  mode: Mode;
  /** CSS custom property name registered in styles.css */
  colorVar: string;
  baseFare: number;
  perKm: number;
  perMin: number;
  unlockLabel?: string;
};

export const PROVIDERS: Provider[] = [
  {
    id: "uber",
    name: "Uber",
    mode: "ride",
    colorVar: "--brand-uber",
    baseFare: 3.4,
    perKm: 1.45,
    perMin: 0.3,
  },
  {
    id: "bolt",
    name: "Bolt",
    mode: "ride",
    colorVar: "--brand-bolt",
    baseFare: 2.9,
    perKm: 1.25,
    perMin: 0.26,
  },
  {
    id: "freenow",
    name: "FreeNow",
    mode: "ride",
    colorVar: "--brand-freenow",
    baseFare: 3.9,
    perKm: 1.6,
    perMin: 0.32,
  },
  {
    id: "taxi",
    name: "Taxi Stuttgart",
    mode: "ride",
    colorVar: "--brand-taxi",
    baseFare: 4.3,
    perKm: 2.4,
    perMin: 0.0,
  },
  {
    id: "lime",
    name: "Lime",
    mode: "scooter",
    colorVar: "--brand-lime",
    baseFare: 1.0,
    perKm: 0,
    perMin: 0.24,
    unlockLabel: "1,00 € unlock",
  },
  {
    id: "tier",
    name: "Tier",
    mode: "scooter",
    colorVar: "--brand-tier",
    baseFare: 1.0,
    perKm: 0,
    perMin: 0.22,
    unlockLabel: "1,00 € unlock",
  },
  {
    id: "voi",
    name: "Voi",
    mode: "scooter",
    colorVar: "--brand-voi",
    baseFare: 1.0,
    perKm: 0,
    perMin: 0.25,
    unlockLabel: "1,00 € unlock",
  },
  {
    id: "dott",
    name: "Dott",
    mode: "scooter",
    colorVar: "--brand-dott",
    baseFare: 1.0,
    perKm: 0,
    perMin: 0.2,
    unlockLabel: "1,00 € unlock",
  },
  {
    id: "nextbike",
    name: "RegioRad",
    mode: "bike",
    colorVar: "--brand-bike",
    baseFare: 0,
    perKm: 0,
    perMin: 0.1,
    unlockLabel: "First 30 min free",
  },
  {
    id: "vvs",
    name: "VVS",
    mode: "transit",
    colorVar: "--brand-transit",
    baseFare: 0,
    perKm: 0,
    perMin: 0,
  },
  {
    id: "walk",
    name: "Walking",
    mode: "walk",
    colorVar: "--brand-walk",
    baseFare: 0,
    perKm: 0,
    perMin: 0,
  },
];

export function providerById(id: string): Provider {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[PROVIDERS.length - 1]!;
}

export const MODE_LABEL: Record<Mode, string> = {
  walk: "Walk",
  scooter: "E-scooter",
  bike: "Bike",
  transit: "Public transit",
  ride: "Ride-hailing",
};

export function deepLink(
  providerId: string,
  pickup: { lat: number; lng: number; name: string },
  dropoff: { lat: number; lng: number; name: string },
): { app: string; web: string } {
  const aff = "ALLRIDE_AFF_STR";
  switch (providerId) {
    case "uber":
      return {
        app: `uber://?client_id=${aff}&action=setPickup&pickup[latitude]=${pickup.lat}&pickup[longitude]=${pickup.lng}&dropoff[latitude]=${dropoff.lat}&dropoff[longitude]=${dropoff.lng}`,
        web: `https://m.uber.com/ul/?client_id=${aff}&action=setPickup&pickup[latitude]=${pickup.lat}&pickup[longitude]=${pickup.lng}&dropoff[latitude]=${dropoff.lat}&dropoff[longitude]=${dropoff.lng}`,
      };
    case "bolt":
      return {
        app: `bolt://action/setPickup?pickup_latitude=${pickup.lat}&pickup_longitude=${pickup.lng}&destination_latitude=${dropoff.lat}&destination_longitude=${dropoff.lng}`,
        web: "https://bolt.eu/en/cities/stuttgart/",
      };
    case "freenow":
      return { app: `freenow://`, web: "https://www.free-now.com/de/" };
    case "taxi":
      return { app: `tel:+4971119410`, web: "https://www.taxi-stuttgart.de/" };
    case "lime":
      return { app: "lime://", web: "https://www.li.me/" };
    case "tier":
      return { app: "tier://", web: "https://www.tier.app/" };
    case "voi":
      return { app: "voiapp://", web: "https://www.voi.com/" };
    case "dott":
      return { app: "dott://", web: "https://ridedott.com/" };
    case "nextbike":
      return { app: "nextbike://", web: "https://www.regioradstuttgart.de/" };
    case "vvs":
      return {
        app: `https://www.vvs.de/`,
        web: `https://www.vvs.de/`,
      };
    default:
      return { app: "/", web: "/" };
  }
}
