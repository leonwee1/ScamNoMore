/**
 * Approximate coordinates for the towns in the dataset, used to place heatmap
 * markers in geographically sensible positions.
 *
 * These are town-centre approximations, accurate enough that the east/west and
 * north/south relationships a Singaporean expects are preserved. They are NOT
 * survey data and should not be used for anything but positioning a label.
 */
export interface TownPoint {
  lat: number;
  lng: number;
}

// NOTE: map bounds live with the geometry, in src/data/singaporeGeo.ts
// (SG_BOUNDS), derived from the real coastline. An approximate second set used
// to live here; it was removed so there is only one source of truth for the
// projection and the two cannot drift apart.

export const TOWN_GEO: Record<string, TownPoint> = {
  'Ang Mo Kio': { lat: 1.3691, lng: 103.8454 },
  Balestier: { lat: 1.3266, lng: 103.8454 },
  Bedok: { lat: 1.3236, lng: 103.9273 },
  Bishan: { lat: 1.3526, lng: 103.8352 },
  'Boon Lay': { lat: 1.3387, lng: 103.7061 },
  Bugis: { lat: 1.3006, lng: 103.8559 },
  'Bukit Merah': { lat: 1.2819, lng: 103.8239 },
  'Bukit Timah': { lat: 1.3294, lng: 103.8021 },
  Changi: { lat: 1.3644, lng: 103.9915 },
  Chinatown: { lat: 1.2836, lng: 103.8439 },
  Clementi: { lat: 1.3151, lng: 103.7653 },
  'Dhoby Ghaut': { lat: 1.2993, lng: 103.8455 },
  Geylang: { lat: 1.3146, lng: 103.8931 },
  'Holland Village': { lat: 1.3109, lng: 103.7963 },
  Hougang: { lat: 1.3713, lng: 103.8924 },
  'Jurong East': { lat: 1.3329, lng: 103.7436 },
  'Jurong West': { lat: 1.3404, lng: 103.7090 },
  Kallang: { lat: 1.3114, lng: 103.8714 },
  Katong: { lat: 1.3049, lng: 103.9065 },
  'Marina Bay': { lat: 1.2806, lng: 103.8607 },
  Newton: { lat: 1.3138, lng: 103.8381 },
  Novena: { lat: 1.3204, lng: 103.8438 },
  Orchard: { lat: 1.3048, lng: 103.8318 },
  Outram: { lat: 1.2805, lng: 103.8395 },
  'Pasir Ris': { lat: 1.3721, lng: 103.9493 },
  'Paya Lebar': { lat: 1.3177, lng: 103.8929 },
  Punggol: { lat: 1.4041, lng: 103.9025 },
  Queenstown: { lat: 1.2946, lng: 103.8059 },
  'Raffles Place': { lat: 1.2839, lng: 103.8515 },
  Redhill: { lat: 1.2896, lng: 103.8169 },
  Sengkang: { lat: 1.3911, lng: 103.8952 },
  Serangoon: { lat: 1.3554, lng: 103.8679 },
  Somerset: { lat: 1.3006, lng: 103.8388 },
  Tampines: { lat: 1.3496, lng: 103.9568 },
  'Tanjong Pagar': { lat: 1.2765, lng: 103.8460 },
  'Telok Blangah': { lat: 1.2708, lng: 103.8094 },
  'Toa Payoh': { lat: 1.3343, lng: 103.8563 },
  Woodlands: { lat: 1.4382, lng: 103.7890 },
  Yishun: { lat: 1.4304, lng: 103.8354 },
  // Not a place — the dataset's catch-all bucket. Deliberately absent so it is
  // never drawn on the map; callers skip towns with no coordinates.
};

// Projection also lives with the geometry: SingaporeHeatmap derives it from
// SG_BOUNDS so the markers and the coastline share one coordinate system.
