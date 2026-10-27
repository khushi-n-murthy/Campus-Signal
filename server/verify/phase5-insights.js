// Phase 5: summaries, forecast, dead zones and the SIM Advisor give exactly the right answers on known data.
import { title, section, check, finish, startTestServer, json, expectEqual } from './lib.js';
import { median, confidence, summarizeByCarrier, deadZones, advise } from '../src/stats.js';
import { Building, Room, Measurement } from '../src/models.js';

title(5, 'Summaries and insights', 'Every number the 3D site shows is a correct median, and the dead-zone and advisor rules fire exactly when they should.');

section('Maths');
await check('Median of odd count', () => expectEqual(median([5, 1, 3]), 3));
await check('Median of even count is the average of the middle two', () => expectEqual(median([1, 2, 3, 10]), 2.5));
await check('Median ignores missing values', () => expectEqual(median([null, 4, undefined, 6]), 5));
await check('Median of nothing is null', () => expectEqual(median([]), null));
await check('Confidence levels', () => expectEqual([confidence(15, 5), confidence(14, 5), confidence(5, 2), confidence(4, 4)], ['high', 'medium', 'medium', 'low']));

// A known dataset: Jio scores 80 at 9 am and 20 at noon in room VER-1; Airtel a steady 50.
const anHourAgo = () => new Date(Date.now() - 3600 * 1000);
function m(carrier, score, hour, device, roomId = 'VER-1', extra = {}) {
  return { roomId, buildingId: 'VER', floor: 0, carrier, score, hour, dow: 1, device, downMbps: score / 4, upMbps: 1, latencyMs: 50, jitterMs: 5, lossPct: 0, createdAt: anHourAgo(), ...extra };
}
const data = [
  ...Array.from({ length: 4 }, (_, i) => m('Jio', 80, 9, `d${i}`)),
  ...Array.from({ length: 4 }, (_, i) => m('Jio', 20, 12, `d${i}`)),
  ...Array.from({ length: 6 }, (_, i) => m('Airtel', 50, i % 2 ? 9 : 12, `a${i}`)),
];

section('Pure rules');
await check('Per-network medians; a tie is broken by number of tests', () => {
  const rows = summarizeByCarrier(data);
  return expectEqual(rows.map((r) => [r.carrier, r.score, r.samples]), [['Jio', 50, 8], ['Airtel', 50, 6]]);
});
await check('Dead zone needs >= 15 tests from >= 5 phones with median < 30', () => {
  const few = Array.from({ length: 14 }, (_, i) => m('Vi', 10, 10, `v${i}`));
  const enough = Array.from({ length: 15 }, (_, i) => m('Vi', 10, 10, `v${i}`));
  const onePhone = Array.from({ length: 30 }, () => m('Vi', 10, 10, 'same-phone'));
  return expectEqual([deadZones(few).length, deadZones(enough).length, deadZones(onePhone).length], [0, 1, 0]);
});
await check('Advisor uses same-time-of-day data when there are 3+ tests', () => {
  const r = advise([{ dow: 1, hour: 9, roomId: 'VER-1' }, { dow: 1, hour: 12, roomId: 'VER-1' }], data);
  return expectEqual([r.slots[0].best, r.slots[1].best, r.slots[0].scores.Jio.basis], ['Jio', 'Airtel', 'same time of day']);
});
await check('Advisor falls back to the all-day average with < 3 nearby tests', () => {
  const r = advise([{ dow: 1, hour: 16, roomId: 'VER-1' }], data);
  return expectEqual(r.slots[0].scores.Jio, { score: 50, basis: 'all-day average', samples: 8 });
});
await check('Advisor treats 11 pm and midnight as neighbours', () => {
  const late = Array.from({ length: 3 }, (_, i) => m('Jio', 90, 0, `n${i}`));
  return expectEqual(advise([{ dow: 1, hour: 23, roomId: 'VER-1' }], late).slots[0].scores.Jio.basis, 'same time of day');
});

section('API on a test database');
const srv = await startTestServer({ includeDemo: true });
const get = async (p) => {
  const res = await fetch(`${srv.base}/api${p}`);
  return { status: res.status, body: await json(res) };
};
await Building.create({ _id: 'VER', name: 'Verify Block', floors: 2, footprint: { x: 0, z: 0, w: 20, d: 10 } });
await Room.create([
  { _id: 'VER-1', buildingId: 'VER', floor: 0, name: 'Verify Room 1', shape: { x: 0, y: 0, w: 10, h: 6 } },
  { _id: 'VER-2', buildingId: 'VER', floor: 1, name: 'Verify Room 2', shape: { x: 0, y: 0, w: 10, h: 6 } },
]);
await Measurement.insertMany([
  ...data,
  m('Jio', 99, 9, 'old', 'VER-1', { createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000) }), // too old: ignored
  m('Vi', 5, 9, 'demo1', 'VER-1', { demo: true }), // practice data
]);

await check('GET /api/rooms/VER-1 lists each network with medians', async () => {
  const { body } = await get('/rooms/VER-1');
  const jio = body.networks.find((n) => n.carrier === 'Jio');
  return expectEqual([jio.score, jio.samples, jio.devices, jio.confidence], [50, 8, 4, 'medium']);
});
await check('Measurements older than WINDOW_DAYS are ignored', async () => {
  const { body } = await get('/rooms/VER-1');
  return expectEqual(body.networks.find((n) => n.carrier === 'Jio').samples, 8, 'Jio samples');
});
await check('Room ids are case-insensitive in the URL', async () => expectEqual((await get('/rooms/ver-1')).status, 200));
await check('Unknown room -> 404', async () => expectEqual((await get('/rooms/NOPE')).status, 404));
await check('Forecast: Jio 80 at 9:00, 20 at 12:00, empty at 15:00', async () => {
  const { body } = await get('/rooms/VER-1/forecast');
  const jio = body.hours.Jio;
  return expectEqual([jio[9].score, jio[12].score, jio[15].score, jio.length], [80, 20, null, 24]);
});
await check('Building view: floors listed with their rooms', async () => {
  const { body } = await get('/buildings/VER');
  return expectEqual(body.floorsDetail.map((f) => f.rooms.map((r) => r._id)), [['VER-1'], ['VER-2']]);
});
await check('Building view with ?carrier=Airtel colours by Airtel only', async () => {
  const { body } = await get('/buildings/VER?carrier=Airtel');
  return expectEqual(body.floorsDetail[0].rooms[0].headline, { score: 50, carrier: 'Airtel', samples: 6, confidence: 'medium' });
});
await check('Room with no tests has no score (not zero)', async () => {
  const { body } = await get('/buildings/VER');
  return expectEqual(body.floorsDetail[1].rooms[0].headline.score, null);
});
await check('Campus view lists the building with its room count', async () => {
  const { body } = await get('/campus');
  const b = body.find((x) => x._id === 'VER');
  return expectEqual(b.rooms, 2, 'rooms');
});
await check('POST /api/advisor answers per slot and recommends a network', async () => {
  const res = await fetch(`${srv.base}/api/advisor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slots: [{ dow: 1, hour: 9, roomId: 'ver-1' }, { dow: 1, hour: 9, roomId: 'VER-1' }, { dow: 2, hour: 12, roomId: 'VER-1' }] }),
  });
  const body = await json(res);
  return expectEqual([body.recommendation, body.wins], ['Jio', { Jio: 2, Airtel: 1 }]);
});
await check('Advisor refuses bad slots (400) and unknown rooms (404)', async () => {
  const post = (slots) => fetch(`${srv.base}/api/advisor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slots }) });
  return expectEqual([(await post([{ dow: 9, hour: 9, roomId: 'VER-1' }])).status, (await post([{ dow: 1, hour: 9, roomId: 'ZZZ' }])).status, (await post([])).status], [400, 404, 400]);
});
await check('Dead-zone report lists rooms that meet the rule', async () => {
  await Measurement.insertMany(Array.from({ length: 16 }, (_, i) => m('Vi', 12, 14, `v${i % 6}`, 'VER-2', { floor: 1 })));
  const { body } = await get('/admin/deadzones');
  return expectEqual(body.zones.map((z) => [z.roomId, z.carrier, z.samples, z.badHours]), [['VER-2', 'Vi', 16, [14]]]);
});

section('Practice (demo) data switch');
await check('INCLUDE_DEMO=true shows practice data', async () => {
  const { body } = await get('/rooms/VER-1');
  return expectEqual(Boolean(body.networks.find((n) => n.carrier === 'Vi')), true);
});
await srv.close({ dropDb: false });
const srv2 = await startTestServer({ includeDemo: false });
await check('INCLUDE_DEMO=false hides practice data', async () => {
  const res = await fetch(`${srv2.base}/api/rooms/VER-1`);
  const body = await json(res);
  return expectEqual(Boolean(body.networks.find((n) => n.carrier === 'Vi')), false);
});
await srv2.close();

finish(5, 'Phase 6 (npm run verify:6)');
