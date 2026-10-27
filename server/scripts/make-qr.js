// Makes one QR code per room (PNG) plus print.html, a printable sheet of labelled codes.
// Each code opens  PUBLIC_URL/t/<roomId>  -> the test page for that room.
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { config } from '../src/config.js';
import { loadCampusFile, validateCampus } from '../src/campusData.js';

const OUT = path.resolve('qr');
const { errors, rooms, buildings } = validateCampus(loadCampusFile());
if (errors.length) {
  console.error('Fix campus.json first:\n - ' + errors.join('\n - '));
  process.exit(1);
}
if (config.publicUrl.includes('localhost')) {
  console.warn('warning: PUBLIC_URL is localhost, so phones cannot open these codes. Set PUBLIC_URL to your hosted URL and re-run.');
}

fs.mkdirSync(OUT, { recursive: true });
const nameOf = Object.fromEntries(buildings.map((b) => [b._id, b.name]));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const cards = [];
for (const room of rooms) {
  const url = `${config.publicUrl}/t/${encodeURIComponent(room._id)}`;
  const file = `${room._id}.png`;
  await QRCode.toFile(path.join(OUT, file), url, { errorCorrectionLevel: 'M', margin: 2, width: 600 });
  cards.push(
    `<div class="card"><img src="${file}" alt="QR for ${esc(room._id)}"><h2>${esc(room.name)}</h2>` +
      `<p>${esc(nameOf[room.buildingId])} &middot; Floor ${room.floor} &middot; ${esc(room._id)}</p>` +
      `<p class="cta">Scan to test this room's network (10 s)</p></div>`,
  );
}
fs.writeFileSync(
  path.join(OUT, 'print.html'),
  `<!doctype html><meta charset="utf-8"><title>CampusSignal QR codes</title><style>
body{font-family:system-ui,sans-serif;margin:0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm;padding:10mm}
.card{border:1px solid #999;border-radius:4mm;padding:4mm;text-align:center;break-inside:avoid}
img{width:100%;max-width:55mm}h2{margin:2mm 0 1mm;font-size:14pt}p{margin:0;font-size:9pt}.cta{margin-top:2mm;font-weight:600}
</style><div class="grid">${cards.join('')}</div>`,
);
console.log(`Wrote ${rooms.length} QR codes and print.html to ${OUT} (links start ${config.publicUrl}/t/)`);
