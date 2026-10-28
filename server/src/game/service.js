// Game logic that touches the database. All the rules live in rules.js; this file only loads
// the player and room history, calls the rules, and saves the result.
// `models` is passed in, so the checks can run it against an in-memory stand-in.
import { summarizeByCarrier } from '../stats.js';
import { hashDevice } from '../routes/measurements.js'; // one anonymous id for tests and for the player
import {
  awardScan, awardRun, validateRun, validateNickname, cleanAvatar, levelFor, questStatus, istDay,
  roomStatus, rexLevel, bountyFor, teamFor, BADGES, QUESTS, DINO,
} from './rules.js';

const validDevice = (d) => typeof d === 'string' && d.length >= 8 && d.length <= 100;

export function publicPlayer(p, now = new Date()) {
  if (!p) return null;
  const lv = levelFor(p.xp);
  return {
    nickname: p.nickname, avatar: p.avatar, team: p.team, xp: p.xp, level: lv, scans: p.scans, rexSightings: p.rexSightings,
    roomsExplored: (p.roomsSeen || []).length, streak: p.streak, dinoBest: p.dinoBest,
    badges: (p.badges || []).map((id) => BADGES.find((b) => b.id === id)).filter(Boolean).map((b) => ({ id: b.id, label: b.label })),
    allBadges: BADGES.map((b) => ({ id: b.id, label: b.label, got: (p.badges || []).includes(b.id) })),
    quests: questStatus(p, istDay(now)),
  };
}

export function createGameService({ models, config }) {
  const { Player, Run, RexEvent, Measurement, Room } = models;
  const salt = config.deviceSalt;

  const byDevice = async (device) => (validDevice(device) ? Player.findOne({ device: hashDevice(device, salt) }).lean() : null);

  return {
    hashDevice: (d) => hashDevice(d, salt),

    async me(device) {
      return publicPlayer(await byDevice(device));
    },

    async createProfile({ device, nickname, avatar, carrier }) {
      if (!validDevice(device)) return { status: 400, error: 'device must be a string of 8-100 characters' };
      const nick = validateNickname(nickname);
      if (!nick.ok) return { status: 400, error: nick.error };
      const hashed = hashDevice(device, salt);
      if (await Player.findOne({ device: hashed }).lean()) return { status: 409, error: 'This phone already has an explorer.' };
      if (await Player.findOne({ nickLower: nick.lower }).lean()) return { status: 409, error: 'That nickname is taken. Try another.' };
      try {
        const doc = await Player.create({
          device: hashed, nickname: nick.value, nickLower: nick.lower, avatar: cleanAvatar(avatar), team: teamFor(carrier),
          xp: 0, scans: 0, rexSightings: 0, roomsSeen: [], streak: 0, lastDay: null, dinoBest: 0, badges: [], createdAt: new Date(),
        });
        return { status: 201, player: publicPlayer(doc.toObject ? doc.toObject() : doc) };
      } catch (err) {
        if (err && err.code === 11000) return { status: 409, error: 'That nickname is taken. Try another.' };
        throw err;
      }
    },

    async updateAvatar({ device, avatar }) {
      const p = await byDevice(device);
      if (!p) return { status: 404, error: 'Create your explorer first.' };
      await Player.updateOne({ _id: p._id }, { $set: { avatar: cleanAvatar(avatar) } });
      return { status: 200, player: publicPlayer({ ...p, avatar: cleanAvatar(avatar) }) };
    },

    async leaderboard(limit = 20) {
      const rows = await Player.find({}).sort({ xp: -1 }).limit(limit).lean();
      return rows.map((p, i) => ({ rank: i + 1, nickname: p.nickname, avatar: p.avatar, team: p.team, xp: p.xp, level: levelFor(p.xp).level, title: levelFor(p.xp).title, rooms: (p.roomsSeen || []).length }));
    },

    // What happened in a room before this scan. Demo data does not count as "explored".
    async roomHistory(roomId) {
      const ms = await Measurement.find({ roomId, demo: { $ne: true } }, 'carrier createdAt').sort({ createdAt: -1 }).limit(500).lean();
      return { count: ms.length, carriers: [...new Set(ms.map((m) => m.carrier))], lastAt: ms[0] ? ms[0].createdAt : null };
    },

    // Called by POST /api/measurements after the test is saved. Never throws into the caller.
    async rewardScan({ device, roomId, carrier, score, history, now = new Date() }) {
      const p = await byDevice(device);
      if (!p) return null;
      const { set, reward } = awardScan(p, { roomId, carrier, score, history, now });
      await Player.updateOne({ _id: p._id }, { $set: set });
      return { reward, player: { nickname: p.nickname, team: set.team } };
    },

    async recordRun({ device, body, now = new Date() }) {
      const p = await byDevice(device);
      if (!p) return { status: 404, error: 'Create your explorer first.' };
      const v = validateRun(body);
      if (!v.ok) return { status: 400, error: 'Invalid run', details: v.errors };
      const run = v.value;
      if (run.roomId && !(await Room.findById(run.roomId).lean())) return { status: 404, error: `No room ${run.roomId}` };
      const { set, reward } = awardRun(p, run, now);
      await Player.updateOne({ _id: p._id }, { $set: set });
      let record = null, isRecord = false, personalBest = false;
      if (run.roomId) {
        const prevTop = (await Run.find({ roomId: run.roomId }).sort({ distance: -1 }).limit(1).lean())[0] || null;
        const mine = await Run.findOne({ roomId: run.roomId, device: p.device }).lean();
        if (!mine) { await Run.create({ roomId: run.roomId, device: p.device, nickname: p.nickname, distance: run.distance, updatedAt: now }); personalBest = true; }
        else if (run.distance > mine.distance) { await Run.updateOne({ _id: mine._id }, { $set: { distance: run.distance, nickname: p.nickname, updatedAt: now } }); personalBest = true; }
        isRecord = personalBest && run.distance >= 100 && (!prevTop || run.distance > prevTop.distance);
        record = (await Run.find({ roomId: run.roomId }).sort({ distance: -1 }).limit(1).lean())[0] || null;
      }
      return { status: 201, reward, isRecord, personalBest, record: record && { nickname: record.nickname, distance: record.distance }, player: publicPlayer({ ...p, ...set }, now) };
    },

    // Rex's Lair opened (auto / manual / offline). Works for guests too: only the hashed phone id is kept.
    async rexOpen({ device, roomId, kind, now = new Date() }) {
      if (!validDevice(device)) return { status: 400, error: 'device must be a string of 8-100 characters' };
      if (!['auto', 'manual', 'offline'].includes(kind)) return { status: 400, error: 'kind must be auto, manual or offline' };
      const id = typeof roomId === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(roomId) ? roomId.toUpperCase() : null;
      if (id && !(await Room.findById(id).lean())) return { status: 404, error: `No room ${id}` };
      const doc = await RexEvent.create({ roomId: id, device: hashDevice(device, salt), kind, played: false, at: now });
      return { status: 201, id: String(doc._id) };
    },

    // The player pressed End (or finished): remember whether they actually ran.
    async rexClose({ device, id, played }) {
      if (!validDevice(device) || typeof id !== 'string' || id.length > 40) return { status: 400, error: 'device and id are required' };
      try {
        await RexEvent.updateOne({ _id: id, device: hashDevice(device, salt) }, { $set: { played: Boolean(played) } });
      } catch {
        return { status: 400, error: 'Unknown id' };
      }
      return { status: 200 };
    },

    // Every room's game state: fog, dead zone, who holds it, bounties. Feeds the map overlays.
    async roomsState(windowFilterFn) {
      const [rooms, ms] = await Promise.all([
        Room.find({}, 'buildingId floor name kind').sort({ buildingId: 1, floor: 1, _id: 1 }).lean(),
        Measurement.find(windowFilterFn(), 'roomId carrier score device createdAt').lean(),
      ]);
      const byRoom = new Map();
      for (const m of ms) { if (!byRoom.has(m.roomId)) byRoom.set(m.roomId, []); byRoom.get(m.roomId).push(m); }
      const out = rooms.map((r) => roomGameState(r, byRoom.get(r._id) || []));
      const explored = out.filter((r) => r.status !== 'fog').length;
      return { rooms: out, coverage: { explored, total: out.length, pct: out.length ? Math.round((explored / out.length) * 100) : 0 } };
    },

    async roomDetail(roomId, windowFilterFn) {
      const room = await Room.findById(roomId).lean();
      if (!room) return null;
      const ms = await Measurement.find(windowFilterFn({ roomId }), 'roomId carrier score downMbps latencyMs jitterMs lossPct device createdAt').lean();
      const state = roomGameState(room, ms);
      const rows = summarizeByCarrier(ms);
      const worst = rows.length ? rows[rows.length - 1] : null;
      const best = rows[0] || null;
      // The Rex track is built from the room's real numbers. No data yet = a medium-hard default.
      const pick = best || { score: 40, latencyMs: 150, jitterMs: 30, lossPct: 2 };
      const top = (await Run.find({ roomId }).sort({ distance: -1 }).limit(3).lean()).map((x) => ({ nickname: x.nickname, distance: x.distance }));
      const opens = await RexEvent.find({ roomId }).lean();
      const rexOpens = { total: opens.length, players: new Set(opens.map((e) => e.device)).size, ended: opens.filter((e) => !e.played).length };
      return { ...state, rexOpens, track: { score: pick.score, latencyMs: pick.latencyMs, jitterMs: pick.jitterMs, lossPct: pick.lossPct }, worstNetwork: worst && { carrier: worst.carrier, score: worst.score }, records: top };
    },
  };
}

export function roomGameState(room, ms) {
  const rows = summarizeByCarrier(ms);
  const best = rows[0] || null;
  const devices = new Set(ms.map((m) => m.device)).size;
  const lastAt = ms.reduce((t, m) => (!t || m.createdAt > t ? m.createdAt : t), null);
  const score = best ? best.score : null;
  return {
    roomId: room._id, buildingId: room.buildingId, floor: room.floor, name: room.name, kind: room.kind,
    samples: ms.length, devices, score, controlledBy: best ? best.carrier : null,
    status: roomStatus({ samples: ms.length, score }),
    rex: rexLevel({ samples: ms.length, devices, score }),
    bounty: bountyFor({ samples: ms.length, lastAt }),
    lastAt,
  };
}

export { QUESTS, DINO };
