// Phase 7: every room has a QR code, and each code really opens that room's test page.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { title, section, check, warn, finish } from './lib.js';
import { config } from '../src/config.js';
import { loadCampusFile, validateCampus } from '../src/campusData.js';

title(7, 'QR codes', 'Each printed code decodes to PUBLIC_URL/t/<room id> for the right room. A wrong sticker would silently mislabel data.');

const { rooms } = validateCampus(loadCampusFile());
const dir = path.resolve('qr');

section('Files (run npm run qr first)');
const haveDir = await check('qr/ folder exists', () => fs.existsSync(dir), 'Run: npm run qr');
if (haveDir) {
  await check('qr/print.html exists', () => fs.existsSync(path.join(dir, 'print.html')), 'Run: npm run qr');
  section('Decode every code');
  let bad = 0;
  for (const room of rooms) {
    const file = path.join(dir, `${room._id}.png`);
    const expected = `${config.publicUrl}/t/${encodeURIComponent(room._id)}`;
    const ok = await check(`${room._id}`, () => {
      if (!fs.existsSync(file)) throw new Error('PNG missing');
      const png = PNG.sync.read(fs.readFileSync(file));
      const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
      if (!code) throw new Error('could not decode the image');
      if (code.data !== expected) throw new Error(`opens ${code.data}, expected ${expected}`);
      return true;
    }, 'Run npm run qr again (it rebuilds every code from campus.json and PUBLIC_URL)');
    if (!ok) bad += 1;
  }
  const extra = fs.readdirSync(dir).filter((f) => f.endsWith('.png') && !rooms.some((r) => `${r._id}.png` === f));
  if (extra.length) warn(`Old codes for rooms no longer in campus.json: ${extra.join(', ')}. Delete them so they are not printed.`);
}
if (config.publicUrl.includes('localhost') || config.publicUrl.includes('127.0.0.1')) {
  warn('PUBLIC_URL points at this computer, so phones cannot open the codes. Fine for now; regenerate after deploying (Phase 9).');
}
finish(7, 'Phase 8 (npm run verify:8)');
