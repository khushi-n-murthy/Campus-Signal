// Phase 8: the 3D site's maths is right, it builds, the Kenney models are usable, and Express serves it.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { title, section, check, warn, finish, startTestServer, expectEqual } from './lib.js';
import { inspectGlb, makeBoxGlb } from './glb.js';

title(8, '3D site', 'The colour scale, room layout and stream motion follow the rules; the site builds; models load; one server serves everything.');

const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.resolve(here, '../../client');
const src = (p) => path.join(CLIENT, 'src', p);
const importClient = (p) => import(pathToFileURL(src(p)).href); // works on Windows paths too

section('Client folder');
const haveClient = await check('client/ exists next to server/', () => fs.existsSync(path.join(CLIENT, 'package.json')), 'The two folders must sit side by side: campussignal/server and campussignal/client');
if (!haveClient) {
  finish(8);
  process.exit();
}
await check('client packages installed', () => {
  for (const p of ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'react-router', 'socket.io-client']) {
    if (!fs.existsSync(path.join(CLIENT, 'node_modules', p, 'package.json'))) throw new Error(`${p} missing`);
  }
  return true;
}, 'cd ../client && npm install');
await check('Vite forwards /api and /socket.io to the server port', () => {
  const cfg = fs.readFileSync(path.join(CLIENT, 'vite.config.js'), 'utf8');
  const port = Number(process.env.PORT) || 4000;
  if (!cfg.includes(`localhost:${port}`)) throw new Error(`vite.config.js does not point at localhost:${port}`);
  if (!cfg.includes("'/socket.io'") || !cfg.includes('ws: true')) throw new Error('the /socket.io proxy needs ws: true');
  return `port ${port}`;
}, 'Match the proxy in client/vite.config.js to PORT in server/.env');

section('Colour scale (lib/colors.js)');
const colors = await importClient('lib/colors.js');
await check('0 is red, 100 is blue, no data is grey', () => expectEqual([colors.scoreHex(0), colors.scoreHex(100), colors.scoreHex(null)], ['#ff3b5c', '#4f7dff', colors.NO_DATA]));
await check('Words match the score bands', () => expectEqual([0, 29, 30, 54, 55, 74, 75, 100, null].map(colors.scoreWord), ['Dead zone', 'Dead zone', 'Weak', 'Weak', 'Good', 'Good', 'Strong', 'Strong', 'No data yet']));
await check('Out-of-range scores are clamped, not crashing', () => expectEqual([colors.scoreHex(-20), colors.scoreHex(140)], ['#ff3b5c', '#4f7dff']));

section('Room layout (scenes/layout.js)');
const layout = await importClient('scenes/layout.js');
await check('Room size is clamped to 6-30 m by 5-30 m', () => expectEqual(layout.roomSize({ shape: { w: 2, h: 100 } }), { width: 6, depth: 30 }));
for (const kind of ['classroom', 'lab', 'library', 'canteen']) {
  await check(`${kind}: every desk and chair stays inside the room, none overlap`, () => {
    for (const [w, d] of [[6, 5], [10, 8], [16, 16], [30, 30]]) {
      const desks = layout.deskLayout(w, d, kind);
      for (const s of desks) {
        const reachX = s.chairs === 'one' ? 0.8 : 0.6;
        const reachZ = s.chairs === 'one' ? 0.6 : 0.8;
        if (Math.abs(s.x) + reachX > w / 2 + 1e-9 || Math.abs(s.z) + reachZ > d / 2 + 1e-9) throw new Error(`desk at ${s.x.toFixed(1)},${s.z.toFixed(1)} sticks out of a ${w}x${d} room`);
      }
      for (let i = 0; i < desks.length; i++) {
        for (let j = i + 1; j < desks.length; j++) {
          if (Math.abs(desks[i].x - desks[j].x) < 1.4 && Math.abs(desks[i].z - desks[j].z) < 1.3) throw new Error('two desks overlap');
        }
      }
      if (desks.length > 48) throw new Error('more than 48 desks');
    }
    return true;
  });
}

section('Signal streams (scenes/streamParams.js)');
const { streamParams } = await importClient('scenes/streamParams.js');
const base = { downMbps: 10, jitterMs: 20, lossPct: 1, confidence: 'high' };
await check('Faster download -> faster particles', () => streamParams({ ...base, downMbps: 30 }).speed > streamParams(base).speed);
await check('More jitter -> more wobble', () => streamParams({ ...base, jitterMs: 60 }).wobble > streamParams(base).wobble);
await check('More packet loss -> more particles die', () => streamParams({ ...base, lossPct: 8 }).deathChance > streamParams(base).deathChance);
await check('Zero loss -> no particle dies', () => expectEqual(streamParams({ ...base, lossPct: 0 }).deathChance, 0));
await check('Fewer tests -> fainter streams', () => expectEqual(['high', 'medium', 'low'].map((c) => streamParams({ ...base, confidence: c }).opacity), [1, 0.75, 0.4]));
await check('Extreme values stay in safe ranges', () => {
  const p = streamParams({ downMbps: 99999, jitterMs: 99999, lossPct: 100, confidence: 'high' });
  return p.speed <= 0.35 && p.wobble <= 0.32 && p.deathChance <= 0.85;
});

section('Speed-test maths and routes (browser code)');
const st = await importClient('lib/speedtest.js');
await check('Phone-side median and jitter', () => expectEqual([st.median([1, 2, 3, 10]), st.median([5]), st.jitter([10, 20, 10]), st.jitter([7])], [2.5, 5, 10, 0]));
await check('No AbortSignal.timeout (missing on iOS 15 and older browsers)', () => {
  const code = fs.readFileSync(src('lib/speedtest.js'), 'utf8').replace(/\/\/.*$/gm, ''); // ignore comments
  return !/AbortSignal\.timeout\s*\(/.test(code);
}, 'Use the fetchWithTimeout helper instead');
const { parseView } = await importClient('lib/routes.js');
await check('Addresses map to the right view', () => expectEqual(
  ['/', '/b/a', '/r/a-101', '/t/LIB-001', '/test', '/zzz'].map((p) => parseView(p).kind + (parseView(p).id ? `:${parseView(p).id}` : '')),
  ['campus', 'building:A', 'room:A-101', 'test:LIB-001', 'pick', 'notfound'],
));
await check('A broken address does not crash the app', () => parseView('/r/%E0%A4').kind === 'room');

section('Kenney models (optional)');
await check('Model checker self-test: accepts a valid .glb', () => {
  const info = inspectGlb(makeBoxGlb(2, 1, 1));
  return expectEqual(info.size, [2, 1, 1]);
});
await check('Model checker self-test: rejects a non-.glb file', () => {
  try {
    inspectGlb(Buffer.from('{"asset":{"version":"2.0"}} this is a .gltf text file'));
  } catch {
    return true;
  }
  throw new Error('a text file was accepted');
});
const { MODELS, MODEL_BASE } = await importClient('config/models.js');
const modelDir = path.join(CLIENT, 'public', MODEL_BASE);
for (const [kind, spec] of Object.entries(MODELS)) {
  const file = path.join(modelDir, spec.file);
  if (!fs.existsSync(file)) {
    warn(`${kind}: ${spec.file} not found in client/public${MODEL_BASE}. The built-in ${kind} shape will be drawn instead.`);
    continue;
  }
  await check(`${kind}: ${spec.file} is a valid self-contained .glb`, () => {
    const { size } = inspectGlb(file);
    const widest = Math.max(size[0], size[2]);
    return `${size.map((v) => v.toFixed(2)).join(' x ')} units; shown ${spec.targetWidth} m wide (scale ${(spec.targetWidth / widest).toFixed(2)})`;
  }, 'Copy the .glb from the kit\'s GLB/GLTF folder, not .obj/.fbx; then check the name in client/src/config/models.js');
}

section('Build');
const built = await check('npm run build succeeds', () => {
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: CLIENT, encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || '').split('\n').filter(Boolean).slice(-6).join(' | '));
  return true;
}, 'Read the error: it names the file and line. Fix it, then re-run this phase');
let assets = [];
if (built) {
  assets = fs.readdirSync(path.join(CLIENT, 'dist', 'assets'));
  await check('3D code is in its own chunk (QR page loads fast on mobile data)', () => {
    if (!assets.some((f) => f.startsWith('ThreeView-') && f.endsWith('.js'))) throw new Error('no ThreeView-*.js chunk; keep the lazy(() => import(\'./ThreeView.jsx\')) in App.jsx');
    const main = assets.filter((f) => f.startsWith('index-') && f.endsWith('.js')).map((f) => fs.statSync(path.join(CLIENT, 'dist', 'assets', f)).size);
    const kb = Math.round(Math.max(...main) / 1024);
    if (kb > 600) throw new Error(`main chunk is ${kb} KB; something pulled three.js into it (only scenes/ files may import three)`);
    return `main chunk ${kb} KB`;
  });
}

section('One server for site + API');
if (built) {
  const srv = await startTestServer();
  const get = (p) => fetch(`${srv.base}${p}`);
  await check('GET / returns the site', async () => {
    const html = await (await get('/')).text();
    return html.includes('<div id="root">') && html.includes('CampusSignal');
  }, 'Build the client (npm run build in client/) before starting the server');
  await check('A QR address (/t/<room>) returns the site, not a 404', async () => expectEqual((await get('/t/ANY-ROOM')).status, 200));
  await check('Built JavaScript files are served', async () => {
    const js = assets.find((f) => f.endsWith('.js'));
    const res = await get(`/assets/${js}`);
    return expectEqual([res.status, (res.headers.get('content-type') || '').includes('javascript')], [200, true]);
  });
  await check('A missing model file is a real 404 (so the app can fall back)', async () => {
    const res = await get('/models/kenney/does-not-exist.glb');
    return expectEqual([res.status, (res.headers.get('content-type') || '').includes('text/html') && res.status === 200], [404, false]);
  });
  await check('API still answers next to the site', async () => expectEqual((await get('/api/health')).status, 200));
  await srv.close();
}

finish(8, 'Phase 9 after you deploy (npm run verify:9 -- https://your-site)');
