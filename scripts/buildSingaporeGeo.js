/**
 * Generates src/data/singaporeGeo.ts from a GeoJSON of Singapore's five
 * Community Development Council districts.
 *
 *   node scripts/buildSingaporeGeo.js <input.geojson>
 *
 * SOURCE AND LICENCE
 * Geometry originates from Natural Earth (public domain, 1:10m admin-1), taken
 * from BenPortner/geojson-atlas which releases it under CC0 1.0 Universal. CC0
 * is a public-domain dedication, so the coordinates can be embedded with no
 * attribution requirement and no share-alike obligation. That is deliberate: a
 * CC BY-SA map image would have forced its licence onto this project.
 *
 * Coordinates are rounded to 4 decimal places — about 11 m at the equator, far
 * finer than a phone screen can show — which keeps the emitted module small.
 */
const fs = require('fs');
const path = require('path');

const input = process.argv[2];
if (!input || !fs.existsSync(input)) {
  console.error('Usage: node scripts/buildSingaporeGeo.js <input.geojson>');
  process.exit(1);
}

const geo = JSON.parse(fs.readFileSync(input, 'utf8'));
const round = (n) => Math.round(n * 1e4) / 1e4;

/** Flatten a feature to its outer rings, dropping holes (none in this data). */
function ringsOf(feature) {
  const g = feature.geometry;
  const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
  return polys.map((poly) => poly[0].map(([lng, lat]) => [round(lng), round(lat)]));
}

const regions = geo.features.map((f) => ({
  name: f.properties.name,
  rings: ringsOf(f),
}));

// Bounds across every coordinate, so the projection fills the canvas.
const pts = regions.flatMap((r) => r.rings.flat());
const bounds = {
  minLng: round(Math.min(...pts.map((p) => p[0]))),
  maxLng: round(Math.max(...pts.map((p) => p[0]))),
  minLat: round(Math.min(...pts.map((p) => p[1]))),
  maxLat: round(Math.max(...pts.map((p) => p[1]))),
};

/** Ray-casting point-in-polygon. */
function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Nearest region centroid, used when a point falls just outside every ring. */
function nearestRegion(lng, lat) {
  let best = null;
  let bestD = Infinity;
  for (const r of regions) {
    for (const ring of r.rings) {
      for (const [x, y] of ring) {
        const d = (x - lng) ** 2 + (y - lat) ** 2;
        if (d < bestD) {
          bestD = d;
          best = r.name;
        }
      }
    }
  }
  return best;
}

// Sanity check only: confirm every town falls on land. A town-to-district
// mapping is deliberately NOT emitted — at 1:10m the district polygons are too
// coarse to place towns reliably (Punggol and Sengkang resolve to Central
// Singapore rather than North East), so shipping that mapping would bake in a
// known error. The heatmap uses the geometry purely as a land mask instead.
const { TOWN_GEO } = require('./_townGeoForBuild.js');
let offshore = 0;
for (const [, { lat, lng }] of Object.entries(TOWN_GEO)) {
  const onLand = regions.some((r) => r.rings.some((ring) => inRing(lng, lat, ring)));
  if (!onLand) offshore++;
}

const out = `// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/buildSingaporeGeo.js <input.geojson>
//
// Geometry: Natural Earth 1:10m admin-1 (public domain) via
// BenPortner/geojson-atlas, released under CC0 1.0 Universal. Embedding is
// therefore unrestricted and requires no attribution.

/** A district outline, as [longitude, latitude] pairs. */
export interface GeoRegion {
  name: string;
  rings: Array<Array<[number, number]>>;
}

/** Singapore's five Community Development Council districts. */
export const SG_REGIONS: GeoRegion[] = ${JSON.stringify(regions)};

/** Bounding box of the geometry above. */
export const SG_BOUNDS = ${JSON.stringify(bounds)};
`;

const dest = path.join(__dirname, '..', 'src', 'data', 'singaporeGeo.ts');
fs.writeFileSync(dest, out);

console.log(`regions: ${regions.length}`);
regions.forEach((r) => console.log(`  ${r.name}: ${r.rings[0].length} pts`));
console.log(`bounds: ${JSON.stringify(bounds)}`);
console.log(`towns on land: ${Object.keys(TOWN_GEO).length - offshore}/${Object.keys(TOWN_GEO).length}`);
console.log(`wrote ${dest} (${(out.length / 1024).toFixed(1)} KB)`);
