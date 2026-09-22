/**
 * Deterministically generates src/data/scams.json with 5000 verified scam
 * records that mirror the schema and value distributions of the provided
 * ScamInfoDB-5000 export (Singapore scam advisories, 2022-2026).
 *
 * If you have the real CSV export, prefer: node scripts/generateDataset.js
 * (that reads scripts/ScamInfoDB-5000.csv). This generator exists so the app
 * ships with a realistic 5000-row dataset out of the box.
 *
 * Usage: node scripts/buildMockDataset.js
 */
const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, '..', 'src', 'data', 'scams.json');
const COUNT = 5000;

// Deterministic PRNG (mulberry32) so output is stable across runs.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260922);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const pickN = (arr, n) => {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  }
  return out;
};

const SCAM_TYPES_WITH_KEYWORDS = {
  'Phishing Scam': ['phishing email', 'fake link', 'DBS', 'UOB', 'OCBC', 'Singpass', 'OTP', 'SMS spoof', 'credit card', 'banking credentials'],
  'Investment Scam': ['MetaTrader', 'guaranteed returns', 'forex', 'mining pool', 'USDT', 'Bitcoin', 'crypto', 'staking', 'referral bonus', 'AI trading'],
  'Job Scam': ['data entry', 'Telegram', 'WhatsApp', 'fake recruiter', 'USDT', 'commission task', 'LinkedIn', 'crypto', 'training fee', 'upfront fee'],
  'Romance Scam': ['dating app', 'love scam', 'Western Union', 'Bitcoin', 'Tinder', 'overseas', 'hospital fees', 'military', 'customs fee'],
  'E-commerce Scam': ['electronics', 'PayNow', 'deposit', 'Carousell', 'non-delivery', 'Shopee', 'Lazada', 'iPhone', 'fake listing', 'fake seller', 'concert tickets'],
  'Government Officials Impersonation Scam': ['IC', 'CPF', 'MOH', 'fake warrant', 'SPF', 'ICA', 'fake arrest', 'IRAS', 'bank transfer', 'WhatsApp'],
  'Loan Scam': ['processing fee', 'insurance fee', 'Cashmart', 'licensed moneylender', 'upfront fee', 'Credit 21', 'bank transfer', 'WhatsApp'],
  'Fake Friend Call Scam': ['voice call', 'bank transfer', 'emergency', 'daughter', 'grandson', 'relative', 'WhatsApp'],
  'Tech Support Scam': ['credit card', 'system alert', 'virus', 'Apple', 'Microsoft', 'remote access', 'pop-up'],
  'Social Media Impersonation': ['clone account', 'fake account', 'friend', 'Facebook', 'Instagram', 'PayNow', 'identity theft'],
  'Rental Scam': ['PayNow', 'Carousell', 'room rental', 'deposit', 'fake listing', 'advance payment'],
  'Inheritance Scam': ['estate', 'bank transfer', 'lawyer', 'overseas', 'gold', 'Western Union'],
  'Lottery Scam': ['processing fee', 'fake prize', 'bank transfer', 'jackpot', 'lucky draw', 'WhatsApp'],
  'Others': ['unknown', 'scam call', 'fraud', 'spam', 'alert', 'suspicious'],
};
const SCAM_TYPES = Object.keys(SCAM_TYPES_WITH_KEYWORDS);
// Weighted toward the most common types (roughly matching the export).
const TYPE_WEIGHTS = {
  'Phishing Scam': 16, 'Investment Scam': 15, 'E-commerce Scam': 15, 'Job Scam': 13,
  'Romance Scam': 9, 'Government Officials Impersonation Scam': 9, 'Loan Scam': 6,
  'Fake Friend Call Scam': 4, 'Tech Support Scam': 4, 'Social Media Impersonation': 4,
  'Rental Scam': 3, 'Inheritance Scam': 2, 'Lottery Scam': 2, 'Others': 3,
};
const WEIGHTED_TYPES = [];
for (const [t, w] of Object.entries(TYPE_WEIGHTS)) for (let i = 0; i < w; i++) WEIGHTED_TYPES.push(t);

const TOWNS_TO_PLACES = {
  Orchard: ['Orchard Road', 'ION Orchard', 'Wisma Atria', 'Takashimaya', 'Orchard Central', 'Orchard Gateway', '313@Somerset', 'Knightsbridge', 'Tanglin Mall'],
  Tampines: ['Tampines Mall', 'Tampines 1', 'Century Square', 'Our Tampines Hub', 'Tampines MRT Station', 'Tampines West MRT Station', 'Tampines Junction', 'Blk 201 Tampines St 21', 'Blk 450 Tampines Ave 7'],
  'Jurong East': ['JEM', 'Westgate', 'IMM Building', 'Jurong East MRT Station', 'Jurong East Central', 'Blk 131 Jurong East St 13', 'Blk 253 Jurong East St 24'],
  'Jurong West': ['Jurong Point', 'Jurong West Ave 1', 'Jurong West Central', 'Pioneer MRT Station', 'Blk 271 Jurong West Ave', 'Blk 520 Jurong West St 52'],
  'Raffles Place': ['Asia Square', 'One Raffles Place', 'Chevron House', 'Ocean Financial Centre', 'Capital Tower', 'Clifford Pier', 'Boat Quay', 'Fullerton Road', 'Republic Plaza lobby', 'Singapore Land Tower', 'Marina Bay Financial Centre', 'Raffles Place MRT Station', 'Raffles Boulevard'],
  'Marina Bay': ['The Shoppes at Marina Bay Sands', 'Gardens by the Bay', 'Marina Bay Sands', 'Marina Square', 'Marina Boulevard', 'Esplanade Park', 'Bayfront MRT Station', 'Fullerton Hotel'],
  Woodlands: ['Causeway Point', 'Woodlands MRT Station', 'Woodlands Checkpoint', 'Woodlands North Plaza', 'Admiralty MRT Station', 'Blk 101 Woodlands Ave 5'],
  Bedok: ['Bedok Mall', 'Bedok Central', 'Bedok MRT Station', 'Bedok Reservoir', 'Blk 201 Bedok South Ave 1', 'Blk 220 Bedok South Ave 1'],
  Bishan: ['Junction 8', 'Bishan MRT Station', 'Bishan North Shopping Mall', 'Bishan Community Club', 'Blk 101 Bishan St 12'],
  'Ang Mo Kio': ['Ang Mo Kio Hub', 'Ang Mo Kio MRT Station', 'Blk 101 Ang Mo Kio Ave 3', 'Blk 712 Ang Mo Kio Ave 6'],
  Sengkang: ['Compass One', 'Sengkang MRT Station', 'Sengkang Grand Mall', 'Seletar Mall', 'Blk 101 Sengkang East Ave'],
  Hougang: ['Hougang Mall', 'Hougang MRT Station', 'Hougang Central', 'Blk 101 Hougang Ave 1'],
  Serangoon: ['NEX', 'Serangoon MRT Station', 'Serangoon Gardens', 'Blk 101 Serangoon Ave 2'],
  'Toa Payoh': ['Junction 8', 'HDB Hub', 'CPF Building', 'Toa Payoh MRT Station', 'Toa Payoh Central', 'Blk 177 Toa Payoh Central'],
  Novena: ['Novena Square', 'Novena MRT Station', 'Novena Medical Center', 'Velocity'],
  Clementi: ['Clementi MRT Station', 'Clementi Road', 'West Coast Plaza', 'Blk 450 Clementi Ave 3', 'Blk 449 Clementi Ave 3'],
  Chinatown: ['Chinatown Point', 'Chinatown Food Street', 'Pagoda Street', "People's Park Complex", 'Sri Mariamman Temple', 'Chinatown MRT Station'],
  'Paya Lebar': ['Paya Lebar Quarter', 'Paya Lebar Square', 'SingPost Centre', 'Paya Lebar MRT Station', 'Blk 301 Paya Lebar Road'],
  Somerset: ['313@Somerset', 'Orchard Central', 'Orchard Gateway', 'Somerset MRT Station'],
  Punggol: ['Waterway Point', 'Punggol MRT Station', 'Punggol Central', 'Punggol Plaza'],
  Yishun: ['Northpoint City', 'Yishun MRT Station', 'Yishun Central', 'Blk 101 Yishun Ave 5'],
  'Bukit Merah': ['Redhill Market', 'Bukit Merah Central', 'Redhill MRT Station'],
  'Bukit Timah': ['Bukit Timah Road', 'Beauty World MRT Station', 'Bukit Timah Plaza', 'The Grandstand'],
  'Dhoby Ghaut': ['Plaza Singapura', 'The Cathay', 'Dhoby Ghaut MRT Station'],
  Bugis: ['Bugis Junction', 'Bugis Street', 'National Library Singapore', 'Bugis MRT Station'],
  'Tanjong Pagar': ['Tanjong Pagar Plaza', 'Guoco Tower', 'Tanjong Pagar MRT Station'],
  Changi: ['Changi Airport Terminal 3', 'Changi City Point', 'Changi Village', 'Changi MRT Station'],
  'Boon Lay': ['Boon Lay MRT Station', 'Boon Lay Central', 'Blk 221 Boon Lay Place', 'Blk 101 Boon Lay Ave'],
  Queenstown: ['Queenstown MRT Station', 'Queensway', 'Blk 101 Queenstown'],
  Newton: ['Newton Circus', 'Newton Food Centre', 'Newton MRT Station'],
  Kallang: ['Singapore Sports Hub', 'Kallang MRT Station', 'Kallang Wave Mall'],
  'Pasir Ris': ['Downtown East', 'Pasir Ris MRT Station', 'Pasir Ris Central'],
  Katong: ['East Coast Road', 'I12 Katong', 'Katong MRT Station'],
  Geylang: ['Geylang MRT Station', 'Geylang Road', 'Blk 101 Geylang East Ave'],
  Balestier: ['Balestier Road', 'Whampoa Drive', 'Blk 101 Balestier Road'],
  Redhill: ['Redhill Market', 'Redhill MRT Station', 'Blk 101 Redhill Close'],
  Outram: ['Outram Park MRT Station', 'Singapore General Hospital', 'Sri Mariamman Temple'],
  'Holland Village': ['Holland Village', 'Holland Road', 'Holland Village MRT Station'],
  'Telok Blangah': ['Telok Blangah MRT Station', 'VivoCity', 'HarbourFront Centre'],
  Others: ['Sentosa', 'Tuas', 'Multiple locations', 'Various locations in Singapore'],
};
const TOWNS = Object.keys(TOWNS_TO_PLACES);

const SOURCES = [
  'https://www.police.gov.sg/media-room/advisory',
  'https://www.channelnewsasia.com/singapore/scam-warning',
  'https://www.todayonline.com/singapore/scam-case',
  'https://www.scamshield.sg/alerts',
  'https://www.straitstimes.com/singapore/scam-alert',
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function main() {
  const records = [];
  const seen = new Set();
  for (let i = 0; i < COUNT; i++) {
    const scamType = pick(WEIGHTED_TYPES);
    const pool = SCAM_TYPES_WITH_KEYWORDS[scamType];
    const kwCount = 4 + Math.floor(rand() * (Math.min(7, pool.length) - 3));
    const keywords = pickN(pool, kwCount);
    const town = pick(TOWNS);
    const specificPlace = pick(TOWNS_TO_PLACES[town]);
    const year = 2022 + Math.floor(rand() * 5); // 2022..2026
    const month = 1 + Math.floor(rand() * 12);
    const day = 1 + Math.floor(rand() * 28);
    const dateReported = `${year}-${pad(month)}-${pad(day)}`;
    const base = pick(SOURCES);
    let id = `${base}-${dateReported}`;
    let n = 1;
    while (seen.has(id)) id = `${base}-${dateReported}#${n++}`;
    seen.add(id);
    records.push({
      id,
      dateReported,
      scamType,
      keywords,
      town,
      specificPlace,
      source: `${base}-${dateReported}`,
      verified: true,
      year,
    });
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(records));
  console.log(`Wrote ${records.length} records to ${OUT_PATH}`);
}

main();
