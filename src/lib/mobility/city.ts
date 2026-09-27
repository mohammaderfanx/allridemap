import type { LatLng } from "./geo";

/** Stylised Stuttgart basemap geometry (hand-traced, simplified). */

export const NECKAR: LatLng[] = [
  { lat: 48.7595, lng: 9.2555 },
  { lat: 48.772, lng: 9.245 },
  { lat: 48.7855, lng: 9.2405 },
  { lat: 48.7955, lng: 9.2295 },
  { lat: 48.8045, lng: 9.2185 },
  { lat: 48.8095, lng: 9.2085 },
  { lat: 48.8155, lng: 9.2005 },
  { lat: 48.8265, lng: 9.1975 },
  { lat: 48.8395, lng: 9.1935 },
  { lat: 48.851, lng: 9.185 },
];

export const PARKS: { name: string; ring: LatLng[] }[] = [
  {
    name: "Schlossgarten",
    ring: [
      { lat: 48.7795, lng: 9.1828 },
      { lat: 48.7855, lng: 9.1855 },
      { lat: 48.7925, lng: 9.1915 },
      { lat: 48.7985, lng: 9.1995 },
      { lat: 48.8015, lng: 9.2075 },
      { lat: 48.7985, lng: 9.2095 },
      { lat: 48.7925, lng: 9.2005 },
      { lat: 48.7855, lng: 9.1915 },
      { lat: 48.7792, lng: 9.1862 },
    ],
  },
  {
    name: "Rosensteinpark",
    ring: [
      { lat: 48.7995, lng: 9.1955 },
      { lat: 48.8065, lng: 9.1975 },
      { lat: 48.8095, lng: 9.2065 },
      { lat: 48.8035, lng: 9.2105 },
      { lat: 48.7985, lng: 9.2045 },
    ],
  },
  {
    name: "Höhenpark Killesberg",
    ring: [
      { lat: 48.7935, lng: 9.1605 },
      { lat: 48.7995, lng: 9.1615 },
      { lat: 48.8015, lng: 9.1705 },
      { lat: 48.7955, lng: 9.1735 },
      { lat: 48.7925, lng: 9.1675 },
    ],
  },
  {
    name: "Weißenburgpark",
    ring: [
      { lat: 48.7645, lng: 9.1785 },
      { lat: 48.7695, lng: 9.1815 },
      { lat: 48.7685, lng: 9.1885 },
      { lat: 48.7625, lng: 9.1865 },
    ],
  },
  {
    name: "Karlshöhe",
    ring: [
      { lat: 48.7655, lng: 9.1555 },
      { lat: 48.7705, lng: 9.1575 },
      { lat: 48.7695, lng: 9.1635 },
      { lat: 48.7645, lng: 9.1625 },
    ],
  },
  {
    name: "Schlosspark Solitude",
    ring: [
      { lat: 48.7885, lng: 9.0985 },
      { lat: 48.7975, lng: 9.1015 },
      { lat: 48.7985, lng: 9.1155 },
      { lat: 48.7885, lng: 9.1175 },
      { lat: 48.7845, lng: 9.1075 },
    ],
  },
];

/** Built-up blocks drawn as soft grey masses. */
export const BUILT_UP: { ring: LatLng[] }[] = [
  {
    ring: [
      { lat: 48.7705, lng: 9.1685 },
      { lat: 48.7835, lng: 9.1695 },
      { lat: 48.7855, lng: 9.1825 },
      { lat: 48.7775, lng: 9.1875 },
      { lat: 48.7695, lng: 9.1795 },
    ],
  },
  {
    ring: [
      { lat: 48.7975, lng: 9.2085 },
      { lat: 48.8095, lng: 9.2125 },
      { lat: 48.8105, lng: 9.2265 },
      { lat: 48.7965, lng: 9.2245 },
    ],
  },
  {
    ring: [
      { lat: 48.7215, lng: 9.1035 },
      { lat: 48.7355, lng: 9.1075 },
      { lat: 48.7365, lng: 9.1265 },
      { lat: 48.7225, lng: 9.1235 },
    ],
  },
  {
    ring: [
      { lat: 48.7415, lng: 9.1585 },
      { lat: 48.7545, lng: 9.1625 },
      { lat: 48.7535, lng: 9.1775 },
      { lat: 48.7415, lng: 9.1745 },
    ],
  },
  {
    ring: [
      { lat: 48.8255, lng: 9.1585 },
      { lat: 48.8385, lng: 9.1625 },
      { lat: 48.8375, lng: 9.1795 },
      { lat: 48.8245, lng: 9.1745 },
    ],
  },
];

export type Road = { class: "major" | "minor"; path: LatLng[] };

export const ROADS: Road[] = [
  {
    class: "major",
    path: [
      { lat: 48.7455, lng: 9.1665 },
      { lat: 48.7635, lng: 9.1685 },
      { lat: 48.7745, lng: 9.1745 },
      { lat: 48.7825, lng: 9.1815 },
      { lat: 48.7935, lng: 9.1915 },
      { lat: 48.8035, lng: 9.2045 },
      { lat: 48.8055, lng: 9.2155 },
    ],
  },
  {
    class: "major",
    path: [
      { lat: 48.6905, lng: 9.1925 },
      { lat: 48.7285, lng: 9.1735 },
      { lat: 48.7485, lng: 9.1695 },
      { lat: 48.7635, lng: 9.1665 },
      { lat: 48.7785, lng: 9.1795 },
      { lat: 48.7905, lng: 9.1775 },
      { lat: 48.8025, lng: 9.1765 },
      { lat: 48.8325, lng: 9.1695 },
    ],
  },
  {
    class: "major",
    path: [
      { lat: 48.7285, lng: 9.1135 },
      { lat: 48.7455, lng: 9.1265 },
      { lat: 48.7625, lng: 9.1495 },
      { lat: 48.7735, lng: 9.1655 },
      { lat: 48.7805, lng: 9.1795 },
    ],
  },
  {
    class: "major",
    path: [
      { lat: 48.8205, lng: 9.1185 },
      { lat: 48.8155, lng: 9.1475 },
      { lat: 48.8035, lng: 9.1685 },
      { lat: 48.7955, lng: 9.1775 },
    ],
  },
  {
    class: "minor",
    path: [
      { lat: 48.7728, lng: 9.1663 },
      { lat: 48.7784, lng: 9.1794 },
      { lat: 48.786, lng: 9.2049 },
      { lat: 48.7925, lng: 9.232 },
    ],
  },
  {
    class: "minor",
    path: [
      { lat: 48.7584, lng: 9.1523 },
      { lat: 48.7636, lng: 9.1662 },
      { lat: 48.7705, lng: 9.1795 },
      { lat: 48.7755, lng: 9.1925 },
    ],
  },
  {
    class: "minor",
    path: [
      { lat: 48.748, lng: 9.169 },
      { lat: 48.7395, lng: 9.1585 },
      { lat: 48.728, lng: 9.147 },
      { lat: 48.728, lng: 9.113 },
    ],
  },
  {
    class: "minor",
    path: [
      { lat: 48.7955, lng: 9.165 },
      { lat: 48.802, lng: 9.177 },
      { lat: 48.8045, lng: 9.203 },
      { lat: 48.8035, lng: 9.2153 },
    ],
  },
  {
    class: "minor",
    path: [
      { lat: 48.7838, lng: 9.1817 },
      { lat: 48.7895, lng: 9.1885 },
      { lat: 48.7935, lng: 9.2055 },
      { lat: 48.7925, lng: 9.232 },
    ],
  },
];

export const DISTRICT_LABELS: { name: string; at: LatLng }[] = [
  { name: "Stuttgart-Mitte", at: { lat: 48.7784, lng: 9.1794 } },
  { name: "Bad Cannstatt", at: { lat: 48.8045, lng: 9.2155 } },
  { name: "Stuttgart-West", at: { lat: 48.7745, lng: 9.1585 } },
  { name: "Stuttgart-Süd", at: { lat: 48.7615, lng: 9.1695 } },
  { name: "Degerloch", at: { lat: 48.748, lng: 9.169 } },
  { name: "Vaihingen", at: { lat: 48.728, lng: 9.113 } },
  { name: "Zuffenhausen", at: { lat: 48.832, lng: 9.169 } },
  { name: "Feuerbach", at: { lat: 48.809, lng: 9.155 } },
];
