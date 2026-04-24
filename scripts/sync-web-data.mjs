/**
 * Vocabulary JSON for the app lives only in `web/data/hsk-{1..7}.json`
 * (written by build-hsk-data.mjs + merge-augment.mjs). We do not copy from
 * repo root `data/` so root `data/hsk-*.json` cannot overwrite the web bundle.
 *
 * This step only checks that `web/data` has the expected files (npm script hook).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const WEB_DATA = path.join(ROOT, 'web', 'data');

function main() {
  if (!fs.existsSync(WEB_DATA)) {
    process.stderr.write(`Missing ${WEB_DATA}. Run npm run build:hsk first.\n`);
    process.exit(1);
  }
  const names = fs.readdirSync(WEB_DATA).filter(f => f.startsWith('hsk-') && f.endsWith('.json'));
  if (!names.length) {
    process.stderr.write(`No hsk-*.json in ${WEB_DATA}. Run npm run build:hsk first.\n`);
    process.exit(1);
  }
  process.stderr.write(`OK: ${names.length} hsk file(s) in web/data (no copy from repo data/).\n`);
}

main();

