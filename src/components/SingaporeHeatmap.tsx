import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { SG_BOUNDS, SG_REGIONS } from '../data/singaporeGeo';
import { TOWN_GEO } from '../data/townGeo';
import { colors, font, radius, spacing } from '../theme';

/**
 * Where reported scams concentrate, as a kernel-density heatmap over a real
 * outline of Singapore.
 *
 * GEOMETRY is embedded from Natural Earth 1:10m (public domain, CC0) — see
 * src/data/singaporeGeo.ts. Drawing from coordinates rather than bundling a map
 * image keeps the component offline-capable and free of licence obligations: a
 * CC BY-SA image would have imposed share-alike on this project.
 *
 * THE SURFACE is a genuine density field, not one marker per town. Each cell's
 * value is the sum of Gaussian contributions from every town, weighted by its
 * case count, so neighbouring areas reinforce each other and the result reads as
 * continuous heat rather than isolated pins. The field is clipped to the
 * coastline so colour never bleeds into the sea.
 */

/** Grid resolution across the width. Finer looks smoother but costs more rects. */
const COLS = 36;

/**
 * Kernel width in degrees (~2 km). Wide enough that adjacent towns merge into
 * one hot region, narrow enough that the east and west stay distinguishable.
 */
const SIGMA = 0.02;

/** Below this share of the peak, leave the land colour showing through. */
const FLOOR = 0.06;

/** How many town names to label. Beyond this they collide and obscure the heat. */
const MAX_LABELS = 8;

/** Colour ramp from low to high density. */
const RAMP: Array<{ at: number; color: string }> = [
  { at: 0.0, color: colors.safe },
  { at: 0.35, color: colors.medium },
  { at: 0.7, color: colors.high },
  { at: 1.0, color: colors.critical },
];

export interface TownActivity {
  town: string;
  count: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Colour for a normalised density, interpolated along RAMP. */
function rampColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  let lo = RAMP[0];
  let hi = RAMP[RAMP.length - 1];
  for (let i = 0; i < RAMP.length - 1; i++) {
    if (clamped >= RAMP[i].at && clamped <= RAMP[i + 1].at) {
      lo = RAMP[i];
      hi = RAMP[i + 1];
      break;
    }
  }
  const span = hi.at - lo.at || 1;
  const k = (clamped - lo.at) / span;
  const a = hexToRgb(lo.color);
  const b = hexToRgb(hi.color);
  const mix = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}

export const SingaporeHeatmap: React.FC<{
  data: TownActivity[];
  title: string;
  subtitle: string;
  lowerLabel: string;
  higherLabel: string;
}> = ({ data, title, subtitle, lowerLabel, higherLabel }) => {
  const [width, setWidth] = useState(0);

  const { minLng, maxLng, minLat, maxLat } = SG_BOUNDS;
  const spanLng = maxLng - minLng;
  const spanLat = maxLat - minLat;
  // Preserve the real aspect ratio so the island is not stretched.
  const height = width * (spanLat / spanLng);

  const toX = (lng: number) => ((lng - minLng) / spanLng) * width;
  const toY = (lat: number) => (1 - (lat - minLat) / spanLat) * height;

  /** Land outline as SVG paths, one per district. */
  const landPaths = useMemo(() => {
    if (width <= 0) return [];
    return SG_REGIONS.flatMap((r) =>
      r.rings.map(
        (ring) =>
          `M ${ring
            .map(([lng, lat]) => `${toX(lng).toFixed(1)},${toY(lat).toFixed(1)}`)
            .join(' L ')} Z`
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  /** Density grid, in pixel space, normalised to its own peak. */
  const cells = useMemo(() => {
    if (width <= 0) return [];

    const points = data
      .map((d) => ({ ...TOWN_GEO[d.town], count: d.count }))
      .filter((p) => p.lat !== undefined && p.lng !== undefined && p.count > 0);
    if (points.length === 0) return [];

    const cell = width / COLS;
    const rows = Math.ceil(height / cell);
    const twoSigmaSq = 2 * SIGMA * SIGMA;

    const raw: Array<{ x: number; y: number; v: number }> = [];
    let peak = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        // Cell centre back-projected into degrees.
        const px = (c + 0.5) * cell;
        const py = (r + 0.5) * cell;
        const lng = minLng + (px / width) * spanLng;
        const lat = minLat + (1 - py / height) * spanLat;

        let v = 0;
        for (const p of points) {
          const dLng = lng - p.lng!;
          const dLat = lat - p.lat!;
          v += p.count * Math.exp(-(dLng * dLng + dLat * dLat) / twoSigmaSq);
        }
        if (v > peak) peak = v;
        raw.push({ x: c * cell, y: r * cell, v });
      }
    }

    if (peak <= 0) return [];
    return raw
      .map((o) => ({ ...o, t: o.v / peak, size: cell }))
      .filter((o) => o.t >= FLOOR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, width, height]);

  /** A few busiest towns, labelled for orientation. */
  const labels = useMemo(
    () =>
      data
        .filter((d) => TOWN_GEO[d.town])
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_LABELS),
    [data]
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.canvas} onLayout={onLayout}>
        {width > 0 ? (
          <>
            <Svg width={width} height={height}>
              <Defs>
                {/* Every district ring together forms the land mask. */}
                <ClipPath id="sgLand">
                  {landPaths.map((d, i) => (
                    <Path key={i} d={d} />
                  ))}
                </ClipPath>
              </Defs>

              {/* Land underneath, so low-density areas still read as land. */}
              {landPaths.map((d, i) => (
                <Path key={`land-${i}`} d={d} fill={colors.surfaceAlt} />
              ))}

              {/* The density field, confined to land. */}
              <G clipPath="url(#sgLand)">
                {cells.map((c, i) => (
                  <Rect
                    key={i}
                    x={c.x}
                    y={c.y}
                    // Slight overdraw removes hairline seams between cells.
                    width={c.size + 0.6}
                    height={c.size + 0.6}
                    fill={rampColor(c.t)}
                    // Fade in with intensity so the edges of hot zones are soft.
                    fillOpacity={0.25 + 0.6 * c.t}
                  />
                ))}
              </G>

              {/* Coastline on top, drawn unclipped so it stays crisp. */}
              {landPaths.map((d, i) => (
                <Path
                  key={`edge-${i}`}
                  d={d}
                  fill="none"
                  stroke={colors.border}
                  strokeWidth={1}
                />
              ))}
            </Svg>

            {labels.map((d) => {
              const p = TOWN_GEO[d.town];
              return (
                <View
                  key={d.town}
                  style={[styles.pin, { left: toX(p.lng) - 46, top: toY(p.lat) - 11 }]}
                  accessible
                  accessibilityLabel={`${d.town}: ${d.count}`}
                >
                  <Text style={styles.pinText} numberOfLines={1}>
                    {d.town} {d.count}
                  </Text>
                </View>
              );
            })}
          </>
        ) : null}
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendText}>{lowerLabel}</Text>
        <View style={styles.legendBar}>
          {Array.from({ length: 24 }, (_, i) => (
            <View
              key={i}
              style={[styles.legendStep, { backgroundColor: rampColor(i / 23) }]}
            />
          ))}
        </View>
        <Text style={styles.legendText}>{higherLabel}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  title: { color: colors.text, fontSize: font.h3, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: font.small },
  canvas: {
    position: 'relative',
    borderRadius: radius.md,
    overflow: 'hidden',
    // Sea colour: the land paths sit on top of this.
    backgroundColor: colors.bg,
  },
  pin: {
    position: 'absolute',
    width: 92,
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(11,27,43,0.78)',
  },
  pinText: { color: colors.text, fontSize: 10, fontWeight: '700' },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendText: { color: colors.textMuted, fontSize: font.small },
  legendBar: { flex: 1, flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  legendStep: { flex: 1, height: 8 },
});
