import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { AnalysisResult, isAssessed } from '../services/analysis';
import { api } from '../services/api';

/**
 * Keep a finished analysis readable in the currently selected language.
 *
 * The problem this solves: headings come from the i18n dictionaries and so
 * re-render the instant the language changes, but `reasons` and `advice` are
 * prose the model wrote and are held in state in whatever language was selected
 * when the request was made. Switching language therefore produced a screen with
 * translated headings above untranslated findings.
 *
 * Rather than re-running the analysis — which could return a different
 * probability and look like the app changing its mind — the existing text is sent
 * to the backend for translation. The verdict is preserved exactly; only its
 * wording changes.
 *
 * Translations are cached per language, so switching back and forth costs one
 * request per language at most. On failure the original text is shown: a verdict
 * in the wrong language is far better than a blank one.
 */
export interface TranslatedAnalysis {
  reasons: string[];
  advice: string;
  /** True while a translation request is in flight. */
  translating: boolean;
}

export function useTranslatedAnalysis(result: AnalysisResult): TranslatedAnalysis {
  const { lang } = useI18n();

  // Language the prose is currently written in. Falls back to the stamp the API
  // client attached at request time.
  const sourceLang = result.language ?? 'en';

  const [reasons, setReasons] = useState(result.reasons);
  const [advice, setAdvice] = useState(result.advice);
  const [translating, setTranslating] = useState(false);

  // Cache keyed by language, seeded with the original.
  const cache = useRef(new Map<string, { reasons: string[]; advice: string }>());
  // Identity of the result the cache belongs to, so a new analysis clears it.
  const owner = useRef<AnalysisResult | null>(null);

  if (owner.current !== result) {
    owner.current = result;
    cache.current = new Map([[sourceLang, { reasons: result.reasons, advice: result.advice }]]);
  }

  useEffect(() => {
    // All scoreless results are rendered from the dictionaries, not model prose,
    // so they are already reactive and must never be sent for translation.
    if (!isAssessed(result)) {
      setTranslating(false);
      return;
    }

    const cached = cache.current.get(lang);
    if (cached) {
      setReasons(cached.reasons);
      setAdvice(cached.advice);
      setTranslating(false);
      return;
    }

    let cancelled = false;
    const payload = [...result.reasons, result.advice];
    if (payload.every((t) => !t?.trim())) return;

    setTranslating(true);
    api
      .translate(payload, lang)
      .then((out) => {
        if (cancelled) return;
        const next = { reasons: out.slice(0, result.reasons.length), advice: out[out.length - 1] };
        cache.current.set(lang, next);
        setReasons(next.reasons);
        setAdvice(next.advice);
      })
      .catch(() => {
        if (cancelled) return;
        // Keep whatever is on screen. Never blank out a scam warning because a
        // translation call failed.
      })
      .finally(() => {
        if (!cancelled) setTranslating(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, result]);

  return { reasons, advice, translating };
}
