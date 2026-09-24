/**
 * Central design tokens for ScamNoMore.
 * Mobile-first: generous touch targets, high-contrast risk colors.
 */
export const colors = {
  // Light, calm surfaces keep the app readable without the heavy dark-blue
  // blocks that made the previous UI feel dense. The darker text maintains
  // contrast for older users and the teal accent is used consistently for
  // actions, links, and selected navigation.
  bg: '#F3F8F7',
  surface: '#FFFFFF',
  surfaceAlt: '#E6F6F2',
  primary: '#0B9F93',
  text: '#123C4A',
  textMuted: '#607A82',
  border: '#D7E5E3',
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
