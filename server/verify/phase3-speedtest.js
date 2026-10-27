// Phase 3: the speed-test endpoints send and receive exactly what the phone's test expects.
import zlib from 'node:zlib';
import { title, section, check, finish, startTestServer, json, expectEqual } from './lib.js';

title(3, 'Speed-test endpoints', 'Ping, download and upload behave exactly as the browser test needs, and cannot be cached or compressed.');

const MiB = 1024 * 1024;
const srv = await startTestServer();
const api = (p) => `${srv.base}/api${p}`;

section('Ping');
await check('GET /api/ping answers 204 (no body)', async () => expectEqual((await fetch(api('/ping'))).status, 204, 'status'));
await check('Ping is never cached', async () => {
  const cc = (await fetch(api('/ping'))).headers.get('cache-control') || '';
  if (!cc.includes('no-store')) throw new Error(`Cache-Control is "${cc}"`);
  return cc;
}, 'Set Cache-Control: no-store, no-transform in routes/speedtest.js');

section('Download');
let body;
await check('GET /api/dl?mb=2 sends exactly 2 MiB', async () => {
  const res = await fetch(api('/dl?mb=2'));
  body = Buffer.from(await res.arrayBuffer());
  return expectEqual(body.length, 2 * MiB, 'bytes');
});
await check('Download bytes are random (a proxy cannot compress them)', () => {
  const ratio = zlib.gzipSync(body).length / body.length;
  if (ratio < 0.99) throw new Error(`gzip shrank it to ${(ratio * 100).toFixed(1)}%`);
  return `gzip ratio ${ratio.toFixed(3)}`;
}, 'Use crypto.randomBytes for the blocks, not text or zeros');
await check('Download headers: octet-stream, no-store, no-transform', async () => {
  const res = await fetch(api('/dl?mb=1'));
  await res.arrayBuffer();
  const cc = res.headers.get('cache-control') || '';
  if (!cc.includes('no-store') || !cc.includes('no-transform')) throw new Error(`Cache-Control "${cc}"`);
  return expectEqual(res.headers.get('content-type'), 'application/octet-stream', 'content-type');
});
const lengthFor = async (q) => {
  const ctrl = new AbortController();
  const res = await fetch(api(`/dl${q}`), { signal: ctrl.signal });
  const len = Number(res.headers.get('content-length'));
  ctrl.abort();
  return len;
};
await check('mb=999 is capped at 16 MiB', async () => expectEqual(await lengthFor('?mb=999'), 16 * MiB, 'content-length'));
await check('mb=0 becomes 1 MiB', async () => expectEqual(await lengthFor('?mb=0'), 1 * MiB, 'content-length'));
await check('No mb defaults to 4 MiB', async () => expectEqual(await lengthFor(''), 4 * MiB, 'content-length'));
await check('Stopping a download early does not crash the server', async () => {
  await lengthFor('?mb=16');
  await new Promise((r) => setTimeout(r, 200));
  return expectEqual((await fetch(api('/ping'))).status, 204, 'server still answering');
});

section('Upload');
await check('POST /api/ul with 1 MiB answers 204', async () => {
  const res = await fetch(api('/ul'), { method: 'POST', body: new Uint8Array(MiB) });
  return expectEqual(res.status, 204, 'status');
});
await check('Upload with no content type still works', async () => {
  const res = await fetch(api('/ul'), { method: 'POST', body: new Blob([new Uint8Array(1000)]) });
  return expectEqual(res.status, 204, 'status');
});
await check('Upload over 8 MiB is refused with 413', async () => {
  const res = await fetch(api('/ul'), { method: 'POST', body: new Uint8Array(9 * MiB) });
  const data = await json(res);
  expectEqual(res.status, 413, 'status');
  return expectEqual(data.error, 'Upload too large', 'error');
});

section('Who am I');
await check('GET /api/whoami from this computer -> Local network', async () => {
  const data = await json(await fetch(api('/whoami')));
  return expectEqual(data.carrier, 'Local network', 'carrier');
});
await check('Unknown API route -> JSON 404', async () => {
  const res = await fetch(api('/nope'));
  await json(res);
  return expectEqual(res.status, 404, 'status');
});

await srv.close();
finish(3, 'Phase 4 (npm run verify:4)');
