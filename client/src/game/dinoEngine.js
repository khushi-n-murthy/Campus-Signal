// Rex's Lair: the runner's rules, with no drawing and no browser code, so it can be tested in Node.
// The track comes from the room's real numbers:
//   packet loss  -> more cacti
//   jitter       -> more flying bugs (jump or duck)
//   latency      -> slower reaction time: bigger lag before a jump or duck starts
//   score        -> overall starting speed
export const W = 600, H = 160, GROUND = 130;       // logical canvas size, ground line
export const PX_PER_M = 30;                          // 30 world pixels = 1 metre
export const FINISH_M = 1000;                        // reaching this = "Reconnected"
export const DINO_X = 60, DINO_W = 22, DINO_H = 24, DUCK_H = 14;

const GRAVITY = 2300, JUMP_V = 760;

// A small seeded random generator so the same room gives the same track.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export const hashSeed = (text) => { let h = 2166136261; for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export function trackFromStats(stats = {}) {
  const score = Number.isFinite(stats.score) ? stats.score : 40;
  const loss = Math.max(0, Math.min(15, Number(stats.lossPct) || 0));
  const jitter = Math.max(0, Math.min(150, Number(stats.jitterMs) || 0));
  const latency = Math.max(0, Math.min(800, Number(stats.latencyMs) || 0));
  return {
    cactusChance: 0.45 + loss * 0.03,              // 0.45 .. 0.9
    bugChance: Math.min(0.5, 0.08 + jitter / 300), // 0.08 .. 0.5
    lagMs: Math.round(latency / 10),               // 0 .. 80 ms before a jump starts
    startSpeed: 8 + (score >= 55 ? 1.5 : 0),       // m/s
    maxSpeed: 22 + (score >= 55 ? 2 : 0),          // stays below the server limit (26)
  };
}

export function createGame({ seed = 1, stats, viewW = W } = {}) {
  const track = trackFromStats(stats);
  const rand = rng(seed);
  return {
    track, rand, viewW, t: 0, x: 0, speed: track.startSpeed,
    dino: { y: 0, vy: 0, ducking: false, jumpQueuedMs: 0 },
    obstacles: [], nextSpawnX: 520, over: false, won: false, cause: null,
  };
}

export const distanceM = (g) => Math.floor(g.x / PX_PER_M);

export function press(g, action) {
  if (g.over) return;
  if (action === 'jump' && g.dino.y === 0 && !g.dino.ducking) g.dino.jumpQueuedMs = g.track.lagMs || 0.001;
  if (action === 'duckStart') { g.dino.ducking = true; if (g.dino.y > 0) g.dino.vy = Math.min(g.dino.vy, -400); }
  if (action === 'duckEnd') g.dino.ducking = false;
}

function spawn(g) {
  const r = g.rand();
  const gap = 260 + g.speed * 22 + g.rand() * 180; // enough room to land and jump again
  if (r < g.track.bugChance && g.x > 600) {
    const high = g.rand() < 0.5;                    // low bug: jump; high bug: duck
    g.obstacles.push({ kind: 'bug', x: g.x + g.viewW + 40, y: high ? 26 : 4, w: 22, h: 14, flap: 0 });
  } else if (g.rand() < g.track.cactusChance) {
    const tall = g.rand() < 0.45;
    g.obstacles.push({ kind: 'cactus', x: g.x + g.viewW + 40, y: 0, w: tall ? 13 : 12, h: tall ? 28 : 18 });
  }
  g.nextSpawnX = g.x + gap;
}

// Advance by dt seconds (callers cap dt so a background tab cannot teleport the dino).
export function step(g, dt) {
  if (g.over) return g;
  dt = Math.min(dt, 0.05);
  g.t += dt;
  const target = g.track.startSpeed + (g.track.maxSpeed - g.track.startSpeed) * Math.min(1, g.x / (FINISH_M * PX_PER_M * 0.9));
  g.speed += (target - g.speed) * Math.min(1, dt * 0.8);
  g.x += g.speed * PX_PER_M * dt;

  const d = g.dino;
  if (d.jumpQueuedMs > 0) {
    d.jumpQueuedMs -= dt * 1000;
    if (d.jumpQueuedMs <= 0 && d.y === 0) { d.vy = JUMP_V; d.jumpQueuedMs = 0; }
  }
  if (d.y > 0 || d.vy > 0) {
    d.vy -= GRAVITY * (d.ducking ? 1.8 : 1) * dt;
    d.y += d.vy * dt;
    if (d.y <= 0) { d.y = 0; d.vy = 0; }
  }

  if (g.x >= g.nextSpawnX) spawn(g);
  g.obstacles = g.obstacles.filter((o) => o.x > g.x - 80);
  for (const o of g.obstacles) if (o.kind === 'bug') o.flap += dt * 8;

  // collisions (a little forgiving: boxes are 3 px smaller than the sprites)
  const dh = d.ducking && d.y === 0 ? DUCK_H : DINO_H;
  const box = { x: g.x + DINO_X + 3, y: d.y, w: DINO_W - 6, h: dh - 3 };
  for (const o of g.obstacles) {
    const ob = { x: o.x + 2, y: o.y, w: o.w - 4, h: o.h - 2 };
    if (box.x < ob.x + ob.w && box.x + box.w > ob.x && box.y < ob.y + ob.h && box.y + box.h > ob.y) {
      g.over = true; g.cause = o.kind; return g;
    }
  }
  if (distanceM(g) >= FINISH_M) { g.over = true; g.won = true; }
  return g;
}

// The numbers the server wants.
export const runResult = (g, roomId) => ({ roomId: roomId || undefined, distance: Math.min(distanceM(g), FINISH_M), durationMs: Math.max(600, Math.round(g.t * 1000)), won: g.won });
