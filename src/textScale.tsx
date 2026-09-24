import React, { createContext, useContext, useMemo, useState } from 'react';

/**
 * Text-size choices are intentionally modest: the smallest setting keeps more
 * of a screen visible, while the largest remains comfortable for low vision.
 * The default is one step below the original app sizing.
 */
export const TEXT_SCALE_MIN = 0.85;
export const TEXT_SCALE_MAX = 1.15;
export const TEXT_SCALE_STEP = 0.05;
export const TEXT_SCALE_DEFAULT = 0.9;

type TextScaleContextValue = {
  scale: number;
  setScale: (scale: number) => void;
};

const TextScaleContext = createContext<TextScaleContextValue | null>(null);

export const clampTextScale = (value: number): number => {
  const clamped = Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, value));
  return Math.round(clamped / TEXT_SCALE_STEP) * TEXT_SCALE_STEP;
};

export const scaled = (size: number, scale: number): number => Math.round(size * scale);

export const TextScaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scale, setScaleState] = useState(TEXT_SCALE_DEFAULT);
  const value = useMemo(
    () => ({ scale, setScale: (next: number) => setScaleState(clampTextScale(next)) }),
    [scale]
  );
  return <TextScaleContext.Provider value={value}>{children}</TextScaleContext.Provider>;
};

export const useTextScale = (): TextScaleContextValue => {
  const context = useContext(TextScaleContext);
  if (!context) throw new Error('useTextScale must be used within TextScaleProvider');
  return context;
};
