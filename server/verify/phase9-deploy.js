// Phase 9: checks the LIVE site after you deploy it.  Usage:  npm run verify:9 -- https://your-site.onrender.com
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { io as connect } from 'socket.io-client';
import { title, section, check, warn, finish, json } from './lib.js';

title(9, 'Deployed site', 'The public site works from outside: database, carrier detection behind the host\'s proxy, speed test, live updates and the QR links.');

const url = (process.argv[2] || '').replace(/\/+$/, '');
if (!/^https?:\/\/[^/]+/.test(url)) {
  console.log('Give the site address: npm run verify:9 -- https://your-site.onrender.com');
  process.exit(1);
}

section('Site');
if (!url.startsWith('https://')) warn('The address is not https. Phones and QR scanners prefer https; most hosts give it for free.');
let health = null;
await check('/api/health answers', async () => {
  health = await json(await fetch(`${url}/api/health`));
  return true;
}, 'Is the service running? Check the host\'s logs. Free hosts can take ~1 minute to wake up: try again');
if (health) {
  await check('Database is connected', () => health.db === true, 'Set MONGODB_URI on the host, and in Atlas > Network Access allow 0.0.0.0/0 (or the host\'s IPs)');
  await check('Carrier database is loaded', () => health.asnDatabase === true, 'Check the host logs for GeoLite2 download errors');
  if (health.practiceData) warn('Practice data is visible. Before real users: set INCLUDE_DEMO=false on the host (and run npm run purge:demo).');
}
await check('The 3D site loads', async () => (await (await fetch(url)).text()).includes('<div id="root">'), 'The build step must run on the host: see the guide\'s deploy settings');
await check('A QR address loads the site', async () => (await fetch(`${url}/t/TEST`)).status === 200);

section('Carrier detection behind the host');
await check('Your real public IP reaches the app (TRUST_PROXY is right)', async () => {
  const who = await json(await fetch(`${url}/api/whoami`));
  if (who.carrier === 'Local network') throw new Error(`the app sees ${who.ip}, the host's internal proxy, instead of you`);
  if (/cloudflare|amazon|google|microsoft|akamai|fastly|render|digitalocean|hetzner|ovh|oracle/i.test(who.org || '')) {
    throw new Error(`the app sees ${who.ip} (${who.org}), a hosting/CDN machine, instead of you`);
  }
  return `seen as ${who.ip} -> ${who.carrier}${who.org ? ` (${who.org})` : ''}. This should be YOUR internet provider`;
}, 'On the host set TRUST_PROXY=1 (if it already is a number, add 1), redeploy, then run this phase again');

section('Speed test over the internet');
await check('4 MiB download arrives complete and uncompressed', async () => {
  const t0 = performance.now();
  const res = await fetch(`${url}/api/dl?mb=4`, { headers: { 'Accept-Encoding': 'identity' } });
  const bytes = (await res.arrayBuffer()).byteLength;
  const secs = (performance.now() - t0) / 1000;
  if (bytes !== 4 * 1024 * 1024) throw new Error(`got ${bytes} bytes`);
  if (res.headers.get('content-encoding')) throw new Error(`the host compressed it (${res.headers.get('content-encoding')})`);
  return `${((bytes * 8) / secs / 1e6).toFixed(1)} Mbps from this computer`;
});
await check('Upload is accepted', async () => (await fetch(`${url}/api/ul`, { method: 'POST', body: new Uint8Array(512 * 1024) })).status === 204);

section('Live updates');
await check('WebSocket connects (live map works)', async () => {
  const s = connect(url, { transports: ['websocket'], reconnection: false, timeout: 8000 });
  await new Promise((resolve, reject) => {
    s.once('connect', resolve);
    s.once('connect_error', reject);
  });
  s.close();
  return true;
}, 'Your host must allow WebSockets (Render, Railway and Fly do; plain static hosting does not)');

section('QR codes point here');
const qrDir = path.resolve('qr');
const pngs = fs.existsSync(qrDir) ? fs.readdirSync(qrDir).filter((f) => f.endsWith('.png')) : [];
if (!pngs.length) {
  warn('No qr/ folder on this computer. Set PUBLIC_URL to this address in server/.env, run npm run qr, then re-run this phase.');
} else {
  await check(`Printed codes open ${url}`, () => {
    const png = PNG.sync.read(fs.readFileSync(path.join(qrDir, pngs[0])));
    const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    if (!code?.data.startsWith(`${url}/t/`)) throw new Error(`${pngs[0]} opens ${code?.data}`);
    return true;
  }, 'Set PUBLIC_URL to this exact address in server/.env, run npm run qr, and print the new codes');
}

console.log(`
Last step, on real phones (cannot be automated):
  1. Turn WiFi OFF, scan a printed code on mobile data. The test page must say "You are on Jio/Airtel/Vi".
  2. Run the test. The 3D room on a laptop must pulse and update within a second.
  3. Turn campus WiFi ON, open ${url}/api/whoami, put "ip"/32 in CAMPUS_CIDRS on the host, redeploy,
     and check the test page now says "Campus WiFi".`);
finish(9);
