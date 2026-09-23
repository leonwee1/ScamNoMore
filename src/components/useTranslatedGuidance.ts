import { useEffect, useRef, useState } from 'react';
import { guidanceFor, ScamGuidance } from '../data/scamGuidance';
import { useI18n } from '../i18n';
import { api } from '../services/api';

/**
 * Scam-type guidance in the selected language.
 *
 * The source copy is English only (see data/scamGuidance.ts); anything else is
 * translated through the backend and cached per language and per scam type, so
 * scrolling back to a type already seen costs nothing.
 *
 * Falls back to the English text whenever translation is unavailable — offline,
 * or if the backend is unreachable. Showing correct advice in the wrong language
 * beats showing none.
 */
export interface TranslatedGuidance extends ScamGuidance {
  translating: boolean;
  /** True when the text shown is the English original despite another language. */
  untranslated: boolean;
}

export function useTranslatedGuidance(scamType?: string): TranslatedGuidance | null {
  const { lang } = useI18n();
  const source = scamType ? guidanceFor(scamType) : undefined;

  const [text, setText] = useState<ScamGuidance | null>(source ?? null);
  const [translating, setTranslating] = useState(false);
  const [untranslated, setUntranslated] = useState(false);

  // key -> translated pair, surviving re-renders and wheel scrolling.
  const cache = useRef(new Map<string, ScamGuidance>());

  useEffect(() => {
    if (!source || !scamType) {
      setText(null);
      return;
    }

    if (lang === 'en') {
      setText(source);
      setUntranslated(false);
      setTranslating(false);
      return;
    }

    const key = `${lang}:${scamType}`;
    const hit = cache.current.get(key);
    if (hit) {
      setText(hit);
      setUntranslated(false);
      setTranslating(false);
      return;
    }

    let cancelled = false;
    // Show the English text immediately so the box is never blank while the
    // translation is in flight.
    setText(source);
    setUntranslated(true);
    setTranslating(true);

    api
      .translate([source.what, source.how], lang)
      .then(([what, how]) => {
        if (cancelled) return;
        const next = { what, how };
        cache.current.set(key, next);
        setText(next);
        setUntranslated(false);
      })
      .catch(() => {
        // Keep the English original on screen.
        if (!cancelled) setUntranslated(true);
      })
      .finally(() => {
        if (!cancelled) setTranslating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lang, scamType, source]);

  if (!text) return null;
  return { ...text, translating, untranslated };
}
