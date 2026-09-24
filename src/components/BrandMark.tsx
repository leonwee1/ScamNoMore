import React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '../theme';

/**
 * ScamNoMore logo: a shield with a tick, drawn as vectors.
 *
 * A shield reads as protection at a glance and the tick says "checked and
 * cleared", which is exactly what the app does — you bring it something
 * suspicious and it tells you whether you are safe.
 *
 * Drawn with react-native-svg rather than shipped as a PNG so it stays sharp at
 * any size and on any screen density, needs no asset pipeline, and renders
 * identically on native and web. Kept deliberately simple: at the ~30px size it
 * appears beside the wordmark, fine detail would turn to mud.
 */
export const BrandMark: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="ScamNoMore">
    <Defs>
      <LinearGradient id="brandShield" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={colors.primary} />
        <Stop offset="1" stopColor="#087A78" />
      </LinearGradient>
      <LinearGradient id="brandGloss" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={colors.white} stopOpacity="0.28" />
        <Stop offset="1" stopColor={colors.white} stopOpacity="0" />
      </LinearGradient>
    </Defs>

    {/* Shield body. The crest is flat and the base tapers to a rounded point. */}
    <Path
      d="M50 5 L89 19 V49 C89 73 71 90 50 97 C29 90 11 73 11 49 V19 Z"
      fill="url(#brandShield)"
    />

    {/* Highlight across the upper half, for a little depth. */}
    <Path
      d="M50 5 L89 19 V44 C72 36 28 36 11 44 V19 Z"
      fill="url(#brandGloss)"
    />

    {/* Safe-green tick: the "cleared" signal, and the only non-blue element so
        the eye lands on it first. */}
    <Path
      d="M31 51 L44 64 L70 37"
      fill="none"
      stroke={colors.safe}
      strokeWidth={10}
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Thin rim to keep the silhouette crisp against a dark background. */}
    <Path
      d="M50 5 L89 19 V49 C89 73 71 90 50 97 C29 90 11 73 11 49 V19 Z"
      fill="none"
      stroke={colors.white}
      strokeOpacity={0.35}
      strokeWidth={3}
    />
  </Svg>
);
