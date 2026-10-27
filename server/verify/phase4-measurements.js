// Phase 4: the score formula, input checks, privacy and rate limit on POST /api/measurements.
import { title, section, check, finish, startTestServer, json, expectEqual } from './lib.js';
import { computeScore, validateMeasurement } from '../src/score.js';
import { Building, Room, Measurement } from '../src/models.js';
import { hashDevice } from '../src/routes/measurements.js';

title(4, 'Saving a test', 'Scores are computed exactly as designed, bad data is refused, phones stay anonymous, and spam is blocked.');

section('Score formula (0-100)');
await check('Perfect test = 100', () => expectEqual(computeScore({ downMbps: 100, latencyMs: 20, jitterMs: 2, lossPct: 0 }), 100));
await check('Dead network = 0', () => expectEqual(computeScore({ downMbps: 0, latencyMs: 2000, jitterMs: 500, lossPct: 50 }), 0));
await check('Exactly half on every part = 50', () => expectEqual(computeScore({ downMbps: 12.5, latencyMs: 225, jitterMs: 55, lossPct: 5 }), 50));
await check('All pings lost: only download counts', () => expectEqual(computeScore({ downMbps: 25, latencyMs: null, jitterMs: null, lossPct: 100 }), 50));
await check('Boundaries: 25 Mbps, 50 ms, 10 ms jitter, 0% loss = 100', () => expectEqual(computeScore({ downMbps: 25, latencyMs: 50, jitterMs: 10, lossPct: 0 }), 100));

section('Input checks');
const good = { roomId: 'VER-1', device: 'device-abcdef-123', downMbps: 20, upMbps: 5, latencyMs: 60, jitterMs: 8, lossPct: 0, connType: 'cellular' };
await check('A good result passes', () => expectEqual(validateMeasurement(good).ok, true));
await check('Room id is upper-cased', () => expectEqual(validateMeasurement({ ...good, roomId: 'ver-1' }).value.roomId, 'VER-1'));
await check('Missing download is refused', () => expectEqual(validateMeasurement({ ...good, downMbps: undefined }).ok, false));
await check('Text instead of a number is refused', () => expectEqual(validateMeasurement({ ...good, upMbps: '5' }).ok, false));
await check('Loss over 100% is refused', () => expectEqual(validateMeasurement({ ...good, lossPct: 140 }).ok, false));
await check('Empty latency with some pings answered is refused', () => expectEqual(validateMeasurement({ ...good, latencyMs: null }).ok, false));
await check('Unknown connType becomes "unknown"', () => expectEqual(validateMeasurement({ ...good, connType: 'pigeon' }).value.connType, 'unknown'));

section('POST /api/measurements against a test database');
const srv = await startTestServer({ rateLimitSeconds: 120 });
await Building.create({ _id: 'VER', name: 'Verify Block', floors: 2, footprint: { x: 0, z: 0, w: 20, d: 10 } });
await Room.create([
  { _id: 'VER-1', buildingId: 'VER', floor: 1, name: 'Verify Room 1', shape: { x: 0, y: 0, w: 10, h: 6 } },
  { _id: 'VER-2', buildingId: 'VER', floor: 1, name: 'Verify Room 2', shape: { x: 10, y: 0, w: 10, h: 6 } },
]);
const post = (body) => fetch(`${srv.base}/api/measurements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

let saved;
await check('A valid test is saved (201) with the server-computed score', async () => {
  const res = await post(good);
  saved = await json(res);
  expectEqual(res.status, 201, 'status');
  return expectEqual(saved.score, computeScore(good), 'score');
});
await check('The server, not the phone, decides the network', async () => {
  const res = await post({ ...good, roomId: 'VER-2', carrier: 'Jio', score: 100 });
  const data = await json(res);
  expectEqual(data.carrier, 'Local network', 'carrier');
  return expectEqual(data.score, computeScore(good), 'score');
});
await check('Saved copy has building, floor, hour and weekday filled in', async () => {
  const doc = await Measurement.findById(saved.id).lean();
  expectEqual([doc.buildingId, doc.floor], ['VER', 1], 'building/floor');
  if (!(doc.hour >= 0 && doc.hour <= 23 && doc.dow >= 0 && doc.dow <= 6)) throw new Error('hour/dow out of range');
  return `hour ${doc.hour}, dow ${doc.dow}`;
});
await check('Privacy: the raw device id is not stored, only its salted hash', async () => {
  const doc = await Measurement.findById(saved.id).lean();
  if (doc.device === good.device) throw new Error('raw device id stored');
  return expectEqual(doc.device, hashDevice(good.device, srv.cfg.deviceSalt), 'device hash');
});
await check('Privacy: no IP address field is stored', async () => {
  const doc = await Measurement.findById(saved.id).lean();
  const leaked = Object.keys(doc).filter((k) => /ip/i.test(k));
  if (leaked.length) throw new Error(`fields ${leaked.join(', ')}`);
  return true;
});
await check('Same phone, same room within 2 minutes -> 429', async () => expectEqual((await post(good)).status, 429, 'status'));
await check('Unknown room -> 404', async () => expectEqual((await post({ ...good, roomId: 'NOPE-9', device: 'other-device-1' })).status, 404, 'status'));
await check('Bad numbers -> 400 with details', async () => {
  const res = await post({ ...good, downMbps: -5, device: 'other-device-2' });
  const data = await json(res);
  expectEqual(res.status, 400, 'status');
  if (!Array.isArray(data.details) || !data.details.length) throw new Error('no details list');
  return data.details[0];
});
await check('Broken JSON -> 400, not a crash', async () => {
  const res = await fetch(`${srv.base}/api/measurements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
  return expectEqual(res.status, 400, 'status');
});

await srv.close();
finish(4, 'Phase 5 (npm run verify:5)');
