// The rules of the CampusSignal game. Pure functions only (no database, no Express), so every
// rule can be tested with plain objects. Change a number here and the whole game changes.

export const TEAMS = ['Jio', 'Airtel', 'Vi', 'BSNL', 'Campus WiFi'];

export const XP = {
  scan: 10, // any scan
  repeatScan: 2, // scanning a room you already scanned today
  firstInRoom: 50, // nobody had tested this room before
  newNetwork: 20, // first test of this network in this room
  rexSighting: 30, // you found a dead zone
  streakStep: 5, // per streak day (2 days = 10 ... capped)
  streakMax: 5,
  staleMult: 2, // room not tested for STALE_DAYS: base XP doubles
  dinoPer100m: 2,
  dinoWin: 25,
};
export const STALE_DAYS = 7;

export const DINO = {
  dailyXpCap: 60, // so nobody farms points by playing instead of scanning
  maxSpeed: 26, // metres per second the game can ever reach (server uses it to reject fake scores)
  finishAt: 1000, // metres to "Reconnect"
  maxDistance: 1500,
};

// XP needed to reach each level (index 0 = level 1).
export const LEVEL_XP = [0, 60, 160, 320, 560, 900, 1400, 2100, 3000, 4200, 6000];
export const LEVEL_TITLES = [
  'Rookie', 'Scout', 'Ranger', 'Pathfinder', 'Navigator', 'Signal Hunter',
  'Mapper', 'Cartographer', 'Wave Rider', 'Grid Master', 'Legend',
];

export function levelFor(xp) {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  let i = 0;
  while (i + 1 < LEVEL_XP.length && x >= LEVEL_XP[i + 1]) i += 1;
  const floor = LEVEL_XP[i];
  const next = i + 1 < LEVEL_XP.length ? LEVEL_XP[i + 1] : null;
  return { level: i + 1, title: LEVEL_TITLES[i], xp: x, floor, next, pct: next == null ? 100 : Math.round(((x - floor) / (next - floor)) * 100) };
}

// ---------- characters ----------
// Same numbers are drawn as pixel art in the browser (client/src/game/pixel.js).
export const AVATAR_LIMITS = { body: 5, skin: 6, hairStyle: 8, hairColor: 8, outfit: 4, outfitColor: 8, accessory: 6, eyewear: 5, headgear: 5, mood: 3, bg: 6 };
export const DEFAULT_AVATAR = { body: 0, skin: 1, hairStyle: 0, hairColor: 0, outfit: 0, outfitColor: 0, accessory: 0, eyewear: 0, headgear: 0, mood: 0, bg: 0 };

export function cleanAvatar(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const [k, max] of Object.entries(AVATAR_LIMITS)) {
    const v = Number(src[k]);
    out[k] = Number.isInteger(v) && v >= 0 && v < max ? v : DEFAULT_AVATAR[k];
  }
  return out;
}

// ---------- nicknames ----------
const BLOCKED = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'porn', 'sex', 'nazi', 'rape', 'admin', 'moderator', 'asshole', 'bastard'];

export function validateNickname(raw) {
  const value = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (value.length < 3 || value.length > 16) return { ok: false, error: 'Pick a nickname with 3 to 16 characters.' };
  if (!/^[A-Za-z0-9_ ]+$/.test(value)) return { ok: false, error: 'Use only letters, numbers, spaces and underscores.' };
  const flat = value.toLowerCase().replace(/[\s_]/g, '').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/\$/g, 's');
  if (BLOCKED.some((w) => flat.includes(w))) return { ok: false, error: 'That nickname is not allowed. Try another.' };
  return { ok: true, value, lower: value.toLowerCase() };
}

// ---------- teams ----------
export function teamFor(carrier) {
  return TEAMS.includes(carrier) ? carrier : null; // 'Local network' / 'Other' = no team
}

// ---------- days (India time, UTC+5:30) ----------
export function istDay(date = new Date()) {
  return new Date(new Date(date).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
export function prevDay(day) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ---------- room state for the map ----------
export const REX = { suspectBelow: 30, minSamples: 2, confirmSamples: 15, confirmDevices: 5 };

// samples = tests in the window; score = best network's median score (or null).
export function roomStatus({ samples, score }) {
  if (!samples) return 'fog';
  if (score != null && score < REX.suspectBelow && samples >= REX.minSamples) return 'dead';
  return score != null && score >= 55 ? 'strong' : 'weak';
}

// Rex is "sighted" when the room looks dead, "confirmed" when enough phones agree (same bar as the IT report).
export function rexLevel({ samples, devices, score }) {
  if (score == null || score >= REX.suspectBelow || samples < REX.minSamples) return 'none';
  return samples >= REX.confirmSamples && devices >= REX.confirmDevices ? 'confirmed' : 'sighted';
}

export function bountyFor({ samples, lastAt }, now = new Date()) {
  if (!samples) return { kind: 'fog', mult: 1, label: 'UNEXPLORED' };
  if (lastAt && (new Date(now) - new Date(lastAt)) / 86400000 >= STALE_DAYS) return { kind: 'stale', mult: XP.staleMult, label: 'STALE x2' };
  return { kind: null, mult: 1, label: null };
}

// ---------- quests and badges ----------
export const QUESTS = [
  { id: 'scan3', label: 'Scan 3 different rooms today', xp: 40, goal: 3, progress: (d) => d.rooms.length },
  { id: 'fog', label: 'Explore an unexplored room', xp: 30, goal: 1, progress: (d) => d.newRooms },
  { id: 'rex', label: 'Run 300 m with Rex', xp: 25, goal: 300, progress: (d) => d.bestRun },
];

export const BADGES = [
  { id: 'first-scan', label: 'First Scan', test: (p) => p.scans >= 1 },
  { id: 'explorer-5', label: 'Explorer: 5 rooms', test: (p) => p.roomsSeen.length >= 5 },
  { id: 'explorer-15', label: 'Cartographer: 15 rooms', test: (p) => p.roomsSeen.length >= 15 },
  { id: 'rex-spotter', label: 'Rex Spotter', test: (p) => p.rexSightings >= 1 },
  { id: 'streak-3', label: '3-day streak', test: (p) => p.streak >= 3 },
  { id: 'rex-runner', label: 'Rex Runner: 500 m', test: (p) => p.dinoBest >= 500 },
  { id: 'reconnected', label: 'Reconnected: 1000 m', test: (p) => p.dinoBest >= DINO.finishAt },
  { id: 'level-5', label: 'Level 5', test: (p) => levelFor(p.xp).level >= 5 },
];

export function emptyDaily(day) {
  return { day, scans: 0, rooms: [], newRooms: 0, dinoXp: 0, bestRun: 0, quests: [] };
}
function dailyFor(player, day) {
  const d = player.daily && player.daily.day === day ? player.daily : null;
  return d ? { ...emptyDaily(day), ...d, rooms: [...(d.rooms || [])], quests: [...(d.quests || [])] } : emptyDaily(day);
}

export function questStatus(player, day) {
  const d = dailyFor(player, day);
  return QUESTS.map((q) => {
    const progress = Math.min(q.goal, q.progress(d));
    return { id: q.id, label: q.label, xp: q.xp, goal: q.goal, progress, done: d.quests.includes(q.id) };
  });
}

function normPlayer(player) {
  return {
    xp: 0, scans: 0, rexSightings: 0, streak: 0, lastDay: null, dinoBest: 0, team: null, ...player,
    roomsSeen: [...(player.roomsSeen || [])], badges: [...(player.badges || [])],
  };
}

// Completes quests and badges on a copy of the player; adds XP lines to `breakdown`.
function settle(p, day, breakdown) {
  const quests = [];
  const d = p.daily;
  for (const q of QUESTS) {
    if (!d.quests.includes(q.id) && q.progress(d) >= q.goal) {
      d.quests.push(q.id);
      p.xp += q.xp;
      breakdown.push({ label: `Quest done: ${q.label}`, xp: q.xp });
      quests.push({ id: q.id, label: q.label, xp: q.xp });
    }
  }
  const newBadges = [];
  for (const b of BADGES) {
    if (!p.badges.includes(b.id) && b.test(p)) {
      p.badges.push(b.id);
      newBadges.push({ id: b.id, label: b.label });
    }
  }
  return { quests, newBadges };
}

const publicFields = (p) => ({
  xp: p.xp, scans: p.scans, rexSightings: p.rexSightings, roomsSeen: p.roomsSeen, streak: p.streak, lastDay: p.lastDay,
  dinoBest: p.dinoBest, team: p.team, badges: p.badges, daily: p.daily,
});

// One saved scan. history = { count, carriers: [..], lastAt } of this room BEFORE the scan.
export function awardScan(player, ctx) {
  const now = ctx.now || new Date();
  const day = istDay(now);
  const p = normPlayer(player);
  p.daily = dailyFor(player, day);
  const before = levelFor(p.xp);
  const breakdown = [];
  const repeat = p.daily.rooms.includes(ctx.roomId);
  const first = ctx.history.count === 0;
  const bounty = bountyFor({ samples: ctx.history.count, lastAt: ctx.history.lastAt }, now);

  if (repeat) {
    breakdown.push({ label: 'Repeat scan (same room today)', xp: XP.repeatScan });
  } else {
    breakdown.push({ label: 'Scan', xp: XP.scan * bounty.mult });
    if (bounty.kind === 'stale') breakdown[0].label = 'Scan (stale room bounty x2)';
    if (first) breakdown.push({ label: 'First scan ever in this room', xp: XP.firstInRoom });
    else if (!ctx.history.carriers.includes(ctx.carrier)) breakdown.push({ label: `First ${ctx.carrier} test in this room`, xp: XP.newNetwork });
    if (ctx.score != null && ctx.score < REX.suspectBelow) {
      breakdown.push({ label: 'Rex sighting (dead zone)', xp: XP.rexSighting });
      p.rexSightings += 1;
    }
  }

  // streak: counted once per day, on the first scan of that day
  if (p.lastDay !== day) {
    p.streak = p.lastDay === prevDay(day) ? p.streak + 1 : 1;
    p.lastDay = day;
    if (p.streak >= 2) breakdown.push({ label: `${p.streak}-day streak`, xp: Math.min(p.streak, XP.streakMax) * XP.streakStep });
  }

  p.scans += 1;
  p.daily.scans += 1;
  if (!repeat) {
    p.daily.rooms.push(ctx.roomId);
    if (first) p.daily.newRooms += 1;
    if (!p.roomsSeen.includes(ctx.roomId) && p.roomsSeen.length < 300) p.roomsSeen.push(ctx.roomId);
  }
  const team = teamFor(ctx.carrier);
  if (team) p.team = team;

  p.xp += breakdown.reduce((t, b) => t + b.xp, 0);
  const { quests, newBadges } = settle(p, day, breakdown);
  const gained = breakdown.reduce((t, b) => t + b.xp, 0);
  const after = levelFor(p.xp);
  return {
    set: publicFields(p),
    reward: {
      xp: gained, breakdown, level: after, leveledUp: after.level > before.level, newBadges, quests,
      streak: p.streak, firstInRoom: first && !repeat, rex: ctx.score != null && ctx.score < REX.suspectBelow && !repeat, team: p.team,
    },
  };
}

// ---------- dino runs ----------
export function validateRun(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = [];
  const distance = Number(b.distance), durationMs = Number(b.durationMs);
  if (!Number.isFinite(distance) || distance < 0 || distance > DINO.maxDistance) errors.push(`distance must be 0-${DINO.maxDistance}`);
  if (!Number.isFinite(durationMs) || durationMs < 500 || durationMs > 15 * 60 * 1000) errors.push('durationMs must be 0.5 s to 15 min');
  if (errors.length === 0 && distance > DINO.maxSpeed * (durationMs / 1000) + 20) errors.push('that distance is not possible in that time');
  const roomId = typeof b.roomId === 'string' && b.roomId.trim() ? b.roomId.trim().toUpperCase() : null;
  if (roomId && !/^[A-Z0-9_-]{1,40}$/.test(roomId)) errors.push('roomId is not valid');
  return { ok: errors.length === 0, errors, value: { distance: Math.floor(distance), durationMs: Math.floor(durationMs), roomId, won: Boolean(b.won) && distance >= DINO.finishAt - 1 } };
}

export function awardRun(player, run, now = new Date()) {
  const day = istDay(now);
  const p = normPlayer(player);
  p.daily = dailyFor(player, day);
  const before = levelFor(p.xp);
  const breakdown = [];
  const raw = Math.floor(run.distance / 100) * XP.dinoPer100m + (run.won ? XP.dinoWin : 0);
  const room = Math.max(0, DINO.dailyXpCap - p.daily.dinoXp);
  const xp = Math.min(raw, room);
  if (xp > 0) breakdown.push({ label: run.won ? 'Reconnected! Rex run' : `Rex run: ${run.distance} m`, xp });
  p.daily.dinoXp += xp;
  p.daily.bestRun = Math.max(p.daily.bestRun, run.distance);
  p.dinoBest = Math.max(p.dinoBest, run.distance);
  p.xp += xp;
  const { quests, newBadges } = settle(p, day, breakdown);
  const gained = breakdown.reduce((t, b) => t + b.xp, 0);
  const after = levelFor(p.xp);
  return {
    set: publicFields(p),
    reward: { xp: gained, breakdown, level: after, leveledUp: after.level > before.level, newBadges, quests, capped: raw > room, dinoXpLeft: Math.max(0, DINO.dailyXpCap - p.daily.dinoXp) },
  };
}
