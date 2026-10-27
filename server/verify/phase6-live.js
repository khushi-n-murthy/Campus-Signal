// Phase 6: a saved test reaches every open browser within a second (what makes the 3D map light up live).
import { io as connect } from 'socket.io-client';
import { title, section, check, finish, startTestServer, expectEqual } from './lib.js';
import { Building, Room } from '../src/models.js';

title(6, 'Live updates', 'When any phone saves a test, every open 3D view is told about it within 1 second.');

const srv = await startTestServer({ rateLimitSeconds: 0 });
await Building.create({ _id: 'VER', name: 'Verify Block', floors: 1, footprint: { x: 0, z: 0, w: 20, d: 10 } });
await Room.create({ _id: 'VER-1', buildingId: 'VER', floor: 0, name: 'Verify Room 1', shape: { x: 0, y: 0, w: 10, h: 6 } });

section('Socket.io');
const viewers = [connect(srv.base, { transports: ['websocket'], reconnection: false }), connect(srv.base, { reconnection: false })];
await check('Two browsers connect (WebSocket and fallback polling)', async () => {
  await Promise.all(viewers.map((s) => new Promise((resolve, reject) => {
    s.once('connect', resolve);
    s.once('connect_error', reject);
  })));
  return true;
}, 'Make sure io is attached to the same httpServer that listens (createApp in src/app.js)');

await check('Both receive measurement:new within 1 second of a save', async () => {
  const waits = viewers.map((s) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('no event within 1 s')), 1000);
    s.once('measurement:new', (e) => {
      clearTimeout(t);
      resolve(e);
    });
  }));
  const res = await fetch(`${srv.base}/api/measurements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: 'VER-1', device: 'live-check-device', downMbps: 30, upMbps: 8, latencyMs: 40, jitterMs: 3, lossPct: 0 }),
  });
  if (res.status !== 201) throw new Error(`save returned ${res.status}`);
  const events = await Promise.all(waits);
  expectEqual(events[0].roomId, 'VER-1', 'roomId');
  return expectEqual([events[0].buildingId, events[0].floor, events[0].score], ['VER', 0, 100], 'event');
});

for (const s of viewers) s.close();
await srv.close();
finish(6, 'Phase 7 (npm run verify:7)');
