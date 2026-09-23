import { useI18n } from './index';
import {
  translateKeyword,
  translateScamType,
  translateScamTypeShort,
  translateTown,
} from './domain';

/**
 * Hook wrapper around the domain translation tables, so components do not each
 * have to read `lang` and thread it into every call.
 *
 * Kept separate from `domain.ts` so that module stays free of React and can be
 * loaded on its own.
 */
export function useDomain() {
  const { lang } = useI18n();
  return {
    lang,
    scamType: (v: string) => translateScamType(v, lang),
    scamTypeShort: (v: string) => translateScamTypeShort(v, lang),
    town: (v: string) => translateTown(v, lang),
    keyword: (v: string) => translateKeyword(v, lang),
    keywords: (list: string[]) => list.map((k) => translateKeyword(k, lang)),
  };
}
