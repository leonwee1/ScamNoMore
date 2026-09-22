/**
 * Reads scripts/ScamInfoDB-5000.csv and produces src/data/scams.json.
 *
 * The CSV has a Keywords column that is quoted and contains commas, so we use a
 * small RFC-4180-style line parser rather than a naive split.
 *
 * Usage: node scripts/generateDataset.js
 */
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, 'ScamInfoDB-5000.csv');
const OUT_PATH = path.join(__dirname, '..', 'src', 'data', 'scams.json');

/** Parse a single CSV line into fields, honoring double-quoted values. */
function parseLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('Missing CSV at ' + CSV_PATH);
    console.error('Place the ScamInfoDB-5000 export there and re-run.');
    process.exit(1);
  }
  const raw = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = parseLine(lines[0]);
  const idx = (name) => header.indexOf(name);

  const iDate = idx('DateReported');
  const iType = idx('ScamTypes');
  const iKw = idx('Keywords');
  const iTown = idx('Town');
  const iPlace = idx('SpecificPlace');
  const iSrc = idx('Source');
  const iVer = idx('Verified');
  const iYear = idx('Year');

  const records = [];
  const seen = new Set();
  for (let i = 1; i < lines.length; i++) {
    const f = parseLine(lines[i]);
    if (f.length < header.length) continue;
    const source = f[iSrc].trim();
    // Source may repeat across rows; make id unique with a suffix if needed.
    let id = source;
    let n = 1;
    while (seen.has(id)) {
      id = `${source}#${n++}`;
    }
    seen.add(id);
    records.push({
      id,
      dateReported: f[iDate].trim(),
      scamType: f[iType].trim(),
      keywords: f[iKw]
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
      town: f[iTown].trim(),
      specificPlace: f[iPlace].trim(),
      source,
      verified: f[iVer].trim().toLowerCase() === 'yes',
      year: parseInt(f[iYear].trim(), 10),
    });
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(records));
  console.log(`Wrote ${records.length} records to ${OUT_PATH}`);
}

main();
