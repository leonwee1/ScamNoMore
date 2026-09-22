/**
 * Central design tokens for ScamNoMore.
 * Mobile-first: generous touch targets, high-contrast risk colors.
 */
export const colors = {
  bg: '#0B1B2B',
  surface: '#12293E',
  surfaceAlt: '#1B3A55',
  primary: '#2EA6FF',
  text: '#F2F6FA',
  textMuted: '#9DB2C6',
  border: '#244763',
  // Risk levels
  safe: '#28C76F',
  low: '#7ED957',
  medium: '#FFB020',
  high: '#FF7A45',
  critical: '#F5365C',
  white: '#FFFFFF',
};

export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

export const riskColor = (level: RiskLevel): string => colors[level];

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
};

export const font = {
  h1: 26,
  h2: 20,
  h3: 17,
  body: 15,
  small: 13,
};
