/**
 * Coverage check: every scam type / town / keyword present in the bundled
 * dataset should either have a translation entry or be a deliberate pass-through
 * (brand and proper nouns). Run with:
 *
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/checkDomainCoverage.ts
 */
import records from '../src/data/scams.json';
import { _tables } from '../src/i18n/domain';

type Row = { scamType: string; town: string; keywords: string[] };
const rows = records as Row[];

const distinct = (values: string[]) => Array.from(new Set(values)).sort();

const types = distinct(rows.map((r) => r.scamType));
const towns = distinct(rows.map((r) => r.town));
const keywords = distinct(rows.flatMap((r) => r.keywords));

/** Proper nouns intentionally rendered unchanged in every language. */
const INTENTIONAL_PASSTHROUGH = new Set([
  'Apple', 'Bitcoin', 'CPF', 'Carousell', 'Cashmart', 'Credit 21', 'DBS',
  'Facebook', 'ICA', 'IRAS', 'Instagram', 'Lazada', 'LinkedIn', 'MOH',
  'MetaTrader', 'Microsoft', 'OCBC', 'OTP', 'PayNow', 'SPF', 'Shopee',
  'Singpass', 'Telegram', 'Tinder', 'UOB', 'USDT', 'Western Union', 'WhatsApp',
  'iPhone',
]);

let failures = 0;

function report(label: string, values: string[], table: Record<string, unknown>) {
  const missing = values.filter((v) => !table[v]);
  console.log(`${label}: ${values.length - missing.length}/${values.length} translated`);
  if (missing.length) {
    console.log(`  MISSING: ${JSON.stringify(missing)}`);
    failures += missing.length;
  }
}

report('scamType', types, _tables.SCAM_TYPES);
report('town', towns, _tables.TOWNS);

const kwMissing = keywords.filter(
  (k) => !_tables.KEYWORDS[k] && !INTENTIONAL_PASSTHROUGH.has(k)
);
const kwPassthrough = keywords.filter((k) => INTENTIONAL_PASSTHROUGH.has(k));
console.log(
  `keyword: ${keywords.length - kwMissing.length - kwPassthrough.length}/${keywords.length} ` +
    `translated, ${kwPassthrough.length} intentional pass-through`
);
if (kwMissing.length) {
  console.log(`  MISSING: ${JSON.stringify(kwMissing)}`);
  failures += kwMissing.length;
}

console.log(failures ? `\nFAIL: ${failures} untranslated value(s)` : '\nOK: full coverage');
process.exit(failures ? 1 : 0);
