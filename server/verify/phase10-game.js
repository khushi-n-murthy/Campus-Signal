// Phase 10: the game. Rules (XP, levels, streaks, quests, badges), nicknames, Rex runs, room states,
// then the real API against a test database. Parts A-E need no database at all
// (run just those with: npm run verify:game).
const NO_DB = process.argv.includes('--no-db');
import { title, section, check, finish, startTestServer, json, expectEqual } from './lib.js';
import * as R from '../src/game/rules.js';
import { createGameService, roomGameState } from '../src/game/service.js';
import { fakeModels } from './fake-models.js';

title(10, 'The game', 'XP, levels, streaks, quests, nicknames, Rex runs and room states all follow the rules, and cannot be farmed.');

section('A. Levels and nicknames');
await check('Level 1 at 0 XP, level 2 at 60, level 3 at 160', () => expectEqual([0, 59, 60, 160].map((x) => R.levelFor(x).level), [1, 1, 2, 3]));
await check('Progress bar percent is between the level floor and the next level', () => expectEqual(R.levelFor(110).pct, 50));
await check('Top level has no "next"', () => expectEqual(R.levelFor(999999).next, null));
await check('Good nickname is accepted and trimmed', () => expectEqual(R.validateNickname('  Nova  Fox ').value, 'Nova Fox'));
await check('Too short / too long / symbols are refused', () => expectEqual(['ab', 'x'.repeat(17), 'no<script>'].map((n) => R.validateNickname(n).ok), [false, false, false]));
await check('Rude words are blocked, even with number tricks', () => expectEqual(['sh1t', 'F u c k', 'AdMiN'].map((n) => R.validateNickname(n).ok), [false, false, false]));
await check('Avatar numbers are clamped to valid ones', () => expectEqual(R.cleanAvatar({ body: 9, skin: -1, hairStyle: 3, outfit: 'x' }), { body: 0, skin: 1, hairStyle: 3, hairColor: 0, outfit: 0, outfitColor: 0, accessory: 0, eyewear: 0, headgear: 0, mood: 0, bg: 0 }));
await check('Android, alien and bear bodies are valid (body 2-4)', () => expectEqual([2, 3, 4, 5].map((b) => R.cleanAvatar({ body: b }).body), [2, 3, 4, 0]));
await check('Only the five real networks make a team', () => expectEqual(['Jio', 'Local network', 'Other', 'Campus WiFi'].map(R.teamFor), ['Jio', null, null, 'Campus WiFi']));

section('B. Scan rewards');
const NOW = new Date('2026-10-28T06:00:00Z'); // 11:30 IST
const fresh = () => ({ xp: 0, roomsSeen: [], badges: [], scans: 0, streak: 0, lastDay: null, dinoBest: 0, rexSightings: 0 });
// XP without the daily-quest bonuses, so each rule can be checked on its own
const base = (reward) => reward.breakdown.filter((b) => !/^Quest done/.test(b.label)).reduce((t, b) => t + b.xp, 0);
const emptyRoom = { count: 0, carriers: [], lastAt: null };
const busyRoom = (carriers = ['Jio'], lastAt = NOW) => ({ count: 8, carriers, lastAt });
await check('First scan ever in an empty room = 10 + 50 XP and a First Scan badge', () => {
  const { reward } = R.awardScan(fresh(), { roomId: 'A-1', carrier: 'Jio', score: 70, history: emptyRoom, now: NOW });
  expectEqual(base(reward), 60, 'xp');
  expectEqual(reward.quests.map((q) => q.id), ['fog'], 'the "explore an unexplored room" quest completes too (+30)');
  return expectEqual(reward.newBadges.map((b) => b.id), ['first-scan'], 'badges');
});
await check('A new network in a busy room = 10 + 20 XP', () => expectEqual(base(R.awardScan(fresh(), { roomId: 'A-1', carrier: 'Airtel', score: 70, history: busyRoom(), now: NOW }).reward), 30));
await check('A known network in a busy room = 10 XP', () => expectEqual(base(R.awardScan(fresh(), { roomId: 'A-1', carrier: 'Jio', score: 70, history: busyRoom(), now: NOW }).reward), 10));
await check('A dead zone scan adds the 30 XP Rex sighting', () => {
  const { reward } = R.awardScan(fresh(), { roomId: 'A-1', carrier: 'Jio', score: 12, history: busyRoom(), now: NOW });
  expectEqual(base(reward), 40, 'xp');
  return expectEqual(reward.rex, true, 'rex flag');
});
await check('A room nobody tested for 7+ days doubles the base XP', () => expectEqual(base(R.awardScan(fresh(), { roomId: 'A-1', carrier: 'Jio', score: 70, history: busyRoom(['Jio'], new Date('2026-10-01T00:00:00Z')), now: NOW }).reward), 20));
await check('Scanning the same room again the same day gives only 2 XP, no bonuses', () => {
  const a = R.awardScan(fresh(), { roomId: 'A-1', carrier: 'Jio', score: 5, history: emptyRoom, now: NOW });
  const b = R.awardScan({ ...fresh(), ...a.set }, { roomId: 'A-1', carrier: 'Jio', score: 5, history: busyRoom(), now: new Date(NOW.getTime() + 600000) });
  expectEqual(base(b.reward), 2, 'repeat xp');
  return expectEqual(b.set.rexSightings, a.set.rexSightings, 'no second sighting');
});
await check('Streak: day 2 gives +10, a missed day resets to 1', () => {
  const d1 = R.awardScan(fresh(), { roomId: 'A-1', carrier: 'Jio', score: 70, history: busyRoom(), now: NOW });
  const d2 = R.awardScan({ ...fresh(), ...d1.set }, { roomId: 'A-2', carrier: 'Jio', score: 70, history: busyRoom(), now: new Date(NOW.getTime() + 86400000) });
  expectEqual([d2.set.streak, d2.reward.breakdown.find((b) => /streak/.test(b.label)).xp], [2, 10], 'day 2');
  const d4 = R.awardScan({ ...fresh(), ...d2.set }, { roomId: 'A-3', carrier: 'Jio', score: 70, history: busyRoom(), now: new Date(NOW.getTime() + 3 * 86400000) });
  return expectEqual(d4.set.streak, 1, 'reset');
});
await check('Quests complete exactly once: 3 different rooms pays 40 XP', () => {
  let p = fresh();
  let paid = 0;
  for (const room of ['R1', 'R2', 'R3', 'R3', 'R4']) {
    const out = R.awardScan(p, { roomId: room, carrier: 'Jio', score: 70, history: busyRoom(), now: NOW });
    paid += out.reward.quests.filter((q) => q.id === 'scan3').length;
    p = { ...p, ...out.set };
  }
  return expectEqual(paid, 1, 'times paid');
});
await check('Level-up is reported', () => {
  const out = R.awardScan({ ...fresh(), xp: 55 }, { roomId: 'A-1', carrier: 'Jio', score: 70, history: busyRoom(), now: NOW });
  return expectEqual([out.reward.leveledUp, out.reward.level.level], [true, 2]);
});

section('C. Rex runs');
const ok = { distance: 400, durationMs: 40000, roomId: 'a-1' };
await check('A believable run is accepted and the room id is upper-cased', () => expectEqual([R.validateRun(ok).ok, R.validateRun(ok).value.roomId], [true, 'A-1']));
await check('Impossible distance for the time is refused (no fake scores)', () => expectEqual(R.validateRun({ distance: 1400, durationMs: 5000 }).ok, false));
await check('Negative / huge / missing numbers are refused', () => expectEqual([{ distance: -5, durationMs: 9000 }, { distance: 99999, durationMs: 900000 }, {}].map((b) => R.validateRun(b).ok), [false, false, false]));
await check('Run XP: 2 per 100 m, +25 for reaching Reconnect', () => {
  const a = R.awardRun(fresh(), { distance: 450, won: false });
  const b = R.awardRun(fresh(), { distance: 1000, won: true });
  return expectEqual([base(a.reward), base(b.reward)], [8, 45]);
});
await check('Daily Rex XP is capped so nobody farms points', () => {
  let p = fresh();
  let total = 0;
  for (let i = 0; i < 10; i++) { const out = R.awardRun(p, { distance: 1000, won: true }, NOW); total += out.set.daily.dinoXp - (p.daily?.dinoXp || 0); p = { ...p, ...out.set }; }
  return expectEqual(p.daily.dinoXp, R.DINO.dailyXpCap, 'daily dino xp');
});

section('D. Room states for the map');
const room = { _id: 'A-1', buildingId: 'A', floor: 0, name: 'Room 1' };
const m = (carrier, score, device, hoursAgo = 1) => ({ roomId: 'A-1', carrier, score, device, createdAt: new Date(Date.now() - hoursAgo * 3600000) });
await check('No tests = fog', () => expectEqual(roomGameState(room, []).status, 'fog'));
await check('Low scores from 2+ tests = dead, "sighted" until 15 tests from 5 phones', () => {
  const few = roomGameState(room, [m('Jio', 10, 'd1'), m('Jio', 14, 'd2')]);
  expectEqual([few.status, few.rex], ['dead', 'sighted'], 'few');
  const many = roomGameState(room, Array.from({ length: 16 }, (_, i) => m('Jio', 10, `d${i % 6}`)));
  return expectEqual(many.rex, 'confirmed', 'many');
});
await check('Best network holds the room', () => expectEqual(roomGameState(room, [m('Jio', 80, 'd1'), m('Airtel', 50, 'd2')]).controlledBy, 'Jio'));
await check('A room untested for a week is a x2 bounty', () => expectEqual(roomGameState(room, [m('Jio', 80, 'd1', 24 * 9)]).bounty.mult, 2));

section('E. Service against an in-memory stand-in');
const models = fakeModels();
const game = createGameService({ models, config: { deviceSalt: 'verify-salt' } });
await models.Room.create({ _id: 'A-1', buildingId: 'A', floor: 0, name: 'Room 1' });
await models.Room.create({ _id: 'A-2', buildingId: 'A', floor: 0, name: 'Room 2' });
const dev = 'device-abcdef-123';
await check('Creating an explorer works and stores only a hash of the device id', async () => {
  const out = await game.createProfile({ device: dev, nickname: 'Nova', avatar: { body: 1, hairStyle: 2 }, carrier: 'Jio' });
  expectEqual([out.status, out.player.team, out.player.avatar.body], [201, 'Jio', 1], 'create');
  if (models.Player.docs[0].device === dev) throw new Error('raw device id stored');
  return true;
});
await check('A taken nickname (any capitals) is refused with 409', async () => expectEqual((await game.createProfile({ device: 'other-device-9999', nickname: 'nOVa', carrier: 'Vi' })).status, 409));
await check('A second explorer on the same phone is refused', async () => expectEqual((await game.createProfile({ device: dev, nickname: 'Another', carrier: 'Jio' })).status, 409));
await check('A scan is rewarded and the player is saved', async () => {
  const history = await game.roomHistory('A-1');
  const out = await game.rewardScan({ device: dev, roomId: 'A-1', carrier: 'Jio', score: 66, history, now: NOW });
  expectEqual(base(out.reward), 60, 'xp');
  return expectEqual((await game.me(dev)).xp, out.reward.xp, 'saved xp');
});
await check('Someone with no explorer gets no reward (and no crash)', async () => expectEqual(await game.rewardScan({ device: 'nobody-nobody-1', roomId: 'A-1', carrier: 'Jio', score: 50, history: emptyRoom, now: NOW }), null));
await check('A Rex run saves, becomes the room record, and a worse run does not replace it', async () => {
  const a = await game.recordRun({ device: dev, body: { roomId: 'A-1', distance: 300, durationMs: 40000 }, now: NOW });
  expectEqual([a.status, a.isRecord, a.record.distance], [201, true, 300], 'first');
  const b = await game.recordRun({ device: dev, body: { roomId: 'A-1', distance: 150, durationMs: 40000 }, now: NOW });
  return expectEqual([b.personalBest, b.record.distance], [false, 300], 'second');
});
await check('A Rex run for an unknown room is a 404, a fake run is a 400', async () => {
  expectEqual((await game.recordRun({ device: dev, body: { roomId: 'ZZ-9', distance: 100, durationMs: 20000 } })).status, 404, 'room');
  return expectEqual((await game.recordRun({ device: dev, body: { roomId: 'A-1', distance: 1400, durationMs: 4000 } })).status, 400, 'fake');
});
await check('Leaderboard lists players by XP', async () => {
  const rows = await game.leaderboard();
  return expectEqual([rows[0].nickname, rows[0].rank], ['Nova', 1]);
});

section('E2. Rex opens (auto-open + End button)');
{
  const dev = 'rex-open-test-device-1';
  const o1 = await game.rexOpen({ device: dev, roomId: 'A-1', kind: 'auto' });
  const o2 = await game.rexOpen({ device: dev, roomId: 'A-1', kind: 'manual' });
  await check('Opening Rex is recorded for a guest (no explorer needed)', () => expectEqual([o1.status, o2.status], [201, 201]));
  await check('Bad kind / bad device are refused', async () => expectEqual([(await game.rexOpen({ device: dev, roomId: 'A-1', kind: 'x' })).status, (await game.rexOpen({ device: 'short', kind: 'auto' })).status], [400, 400]));
  await check('Unknown room is refused', async () => expectEqual((await game.rexOpen({ device: dev, roomId: 'NOPE-1', kind: 'auto' })).status, 404));
  await game.rexClose({ device: dev, id: o2.id, played: true });
  await check('Another phone cannot close my event', async () => { await game.rexClose({ device: 'someone-else-device', id: o1.id, played: true }); return expectEqual(models.RexEvent.docs.find((d) => String(d._id) === o1.id).played, false); });
  await check('Room detail counts opens, players and ended-without-playing', async () => {
    const d = await game.roomDetail('A-1', (e = {}) => ({ ...e }));
    return expectEqual(d.rexOpens, { total: 2, players: 1, ended: 1 });
  });
}

if (!NO_DB) {
  section('F. The real API and database');
  const srv = await startTestServer({ rateLimitSeconds: 0 });
  const { Building, Room, Player, Run } = await import('../src/models.js');
  await Building.create({ _id: 'GV', name: 'Game Verify', floors: 1, footprint: { x: 0, z: 0, w: 20, d: 10 } });
  await Room.create({ _id: 'GV-1', buildingId: 'GV', floor: 0, name: 'GV Room 1', shape: { x: 0, y: 0, w: 10, h: 6 } });
  const call = (method, url, body, headers = {}) => fetch(`${srv.base}${url}`, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const gdev = 'game-verify-device-01';
  await check('GET /api/game/me is 404 before an explorer exists', async () => expectEqual((await call('GET', '/api/game/me', null, { 'x-device': gdev })).status, 404));
  await check('POST /api/game/profile creates an explorer (201)', async () => expectEqual((await call('POST', '/api/game/profile', { device: gdev, nickname: 'VerifyBot', avatar: { body: 1 } })).status, 201));
  await check('Saved player has no raw device id', async () => {
    const doc = await Player.findOne({ nickLower: 'verifybot' }).lean();
    if (doc.device === gdev) throw new Error('raw device id stored');
    return true;
  });
  await check('A saved test returns a reward with XP', async () => {
    const res = await call('POST', '/api/measurements', { roomId: 'GV-1', device: gdev, downMbps: 20, upMbps: 5, latencyMs: 60, jitterMs: 8, lossPct: 0, connType: 'wifi' });
    const data = await json(res);
    expectEqual(res.status, 201, 'status');
    return expectEqual(data.reward.xp >= 60, true, 'xp');
  });
  await check('A test from someone without an explorer still saves, with reward = null', async () => {
    const res = await call('POST', '/api/measurements', { roomId: 'GV-1', device: 'guest-device-xyz-123', downMbps: 20, upMbps: 5, latencyMs: 60, jitterMs: 8, lossPct: 0 });
    const data = await json(res);
    expectEqual(res.status, 201, 'status');
    return expectEqual(data.reward, null, 'reward');
  });
  await check('GET /api/game/rooms-state lists the room as explored', async () => {
    const data = await json(await call('GET', '/api/game/rooms-state'));
    const r = data.rooms.find((x) => x.roomId === 'GV-1');
    return expectEqual([r.status !== 'fog', data.coverage.total >= 1], [true, true]);
  });
  await check('POST /api/game/runs saves a run and GET /api/game/room/:id shows the record', async () => {
    const res = await call('POST', '/api/game/runs', { device: gdev, roomId: 'GV-1', distance: 250, durationMs: 30000 });
    expectEqual(res.status, 201, 'status');
    const room = await json(await call('GET', '/api/game/room/GV-1'));
    return expectEqual(room.records[0].distance, 250, 'record');
  });
  await check('GET /api/game/leaderboard answers', async () => expectEqual((await json(await call('GET', '/api/game/leaderboard')))[0].nickname, 'VerifyBot'));
  await Player.deleteMany({});
  await Run.deleteMany({});
  await srv.close();


}

finish(10, 'the game screens (phase 8 again after adding them)');
