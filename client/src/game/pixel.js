// Pixel art for the game, drawn from tiny grids and numbers. Nothing is an image file:
// characters come from the avatar numbers (same ones the server saves), icons from text grids.
// Original art: the characters and Rex are our own designs, in a neon-blue 1-bit-ish palette.

export const INK = '#050b26';
const PAL = {
  k: INK, w: '#f2f8ff', c: '#2de2ff', b: '#2f6bff', d: '#16205a', l: '#bfe6ff',
  g: '#5cc8ff', p: '#ff5fa2', y: '#ffd23f', o: '#ff9a3c', r: '#ff4d6d', s: '#7d8fb8',
};

// ---------- characters live in portrait.js ----------
import { drawPortrait, normalizeAvatar } from './portrait.js';
export { AVATAR_LIMITS, DEFAULT_AVATAR, BODIES, SKIN, TONES, HAIR, OUTFIT, BG, HAIR_STYLES, OUTFITS, GEAR, EYEWEAR, HEADGEAR, MOODS, HUMAN, PRESETS, normalizeAvatar, randomAvatar, CHAR_W, CHAR_H } from './portrait.js';

function mix(hex, to, f) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}
const lighten = (h, f) => mix(h, '#ffffff', f);
const darken = (h, f) => mix(h, '#000000', f);


function newGrid(w, h) { return Array.from({ length: h }, () => Array(w).fill(null)); }

// Adds a 1-pixel dark outline around every filled pixel, like the sticker look of classic pixel sprites.
function outline(g, color = INK) {
  const h = g.length, w = g[0].length;
  const out = g.map((row) => row.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (g[y][x]) continue;
    if ((y > 0 && g[y - 1][x]) || (y < h - 1 && g[y + 1][x]) || (x > 0 && g[y][x - 1]) || (x < w - 1 && g[y][x + 1])) out[y][x] = color;
  }
  return out;
}

function toCanvas(g) {
  const h = g.length, w = g[0].length;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x]) { ctx.fillStyle = g[y][x]; ctx.fillRect(x, y, 1, 1); }
  return cv;
}

// ---------- icons and creatures (text grids) ----------
const ICONS = {
  star: ['.....y.....', '.....y.....', '....yyy....', 'yyyyyyyyyyy', '.yyyyyyyyy.', '..yyyyyyy..', '..yyyyyyy..', '.yyyy.yyyy.', '.yyy...yyy.', '.yy.....yy.'],
  trophy: ['yyyyyyyyyyy', 'y.yyyyyyy.y', 'y.yyyyyyy.y', '.yyyyyyyyy.', '..yyyyyyy..', '...yyyyy...', '....yyy....', '....yyy....', '...yyyyy...', '..yyyyyyy..'],
  hourglass: ['wwwwwwwww', '.wcccccw.', '..wcccw..', '...wcw...', '....w....', '...wbw...', '..wbbbw..', '.wbbbbbw.', 'wwwwwwwww'],
  clipboard: ['...ddd...', '.lllllll.', '.lwwwwwl.', '.lgwcccl.', '.lwwwwwl.', '.lgwcccl.', '.lwwwwwl.', '.lgwcccl.', '.lwwwwwl.', '.lllllll.'],
  coin: ['..yyyy..', '.yywwyy.', 'yywyyyyy', 'ywyyyyyy', 'yyyyyyyy', 'yyyyyyoy', '.yyyyoy.', '..yooy..'],
  bolt: ['....yyy', '...yyy.', '..yyy..', '.yyyyyy', 'yyyyyy.', '...yy..', '..yy...', '.yy....'],
  crown: ['y....y....y', 'yy..yyy..yy', 'yyyyyyyyyyy', 'yyyyyyyyyyy', 'yoyyyoyyyoy', 'yyyyyyyyyyy', '.ooooooooo.'],
  shield: ['ccccccccc', 'cwwcccccc', 'cwcccccbc', 'ccccccccc', 'ccccccccc', '.ccccccc.', '.ccccccc.', '..ccccc..', '...ccc...', '....c....'],
  fog: ['.ccccc.', 'cc...cc', '.....cc', '....cc.', '...cc..', '...cc..', '.......', '...cc..', '...cc..'],
  check: ['.......gg', '......gg.', 'gg...gg..', '.gg.gg...', '..ggg....', '...g.....'],
  cactus: ['...ggg...', '...ggg...', '.g.ggg...', '.g.ggg.g.', '.g.ggg.g.', '.ggggg.g.', '...ggggg.', '...ggg...', '...ggg...', '...ggg...', '...ggg...', '...ggg...', '...ggg...', '...ggg...'],
  cactusLow: ['...ggg...', '...ggg...', '.g.ggg...', '.g.ggg.g.', '.g.ggg.g.', '.ggggg.g.', '...ggggg.', '...ggg...', '...ggg...'],
  bug: ['..p.....p..', '...p...p...', '..ppppppp..', '.pp.wpw.pp.', 'ppppppppppp', 'p.ppppppp.p', 'p.p.....p.p', '...pp.pp...'],
  bug2: ['...........', 'p.........p', '.p.......p.', '..ppppppp..', '.pp.wpw.pp.', 'ppppppppppp', 'p.ppppppp.p', '...pp.pp...'],
};

// Rex: our own dinosaur, with a (broken) Wi-Fi antenna. Frames share one body and swap legs.
const REX_BODY = [
  '.................c....',
  '.................d....',
  '..........bbbbbbbb....',
  '..........bbbbbbbbbb..',
  '..........bbbbbwkbbbbb',
  '..........bbbbbbbbbbbb',
  '..........bbbbbbbbbbbb',
  '..........bbbbbbbbllll',
  '....c.c...bbbbbbbbb...',
  '...bbbbbbbbbbbbb......',
  'bb.bbbbbbbbbbbbb......',
  'bbbbbbbbbbbbbbbb.bb...',
  '.bbbbbbbbbllllbbb.....',
  '..bbbbbbbbllllbbb.....',
  '...bbbbbbbllllbb......',
  '....bbbbbbbbbbb.......',
];
const REX_LEGS = {
  a: ['.....bbb....bbb.......', '.....bbb....bbb.......', '....bbbb.....bb.......', '....bbbb....bbbb......'],
  b: ['......bbb..bbb........', '......bbb..bbb........', '.....bbb....bbbb......', '.....bbb...bbbb.......'],
  stand: ['.....bbb....bbb.......', '.....bbb....bbb.......', '.....bbb....bbb.......', '....bbbb...bbbb.......'],
};
const REX_PAL = { ...PAL, b: '#2f6bff', c: '#2de2ff', l: '#bfe6ff', d: '#7d8fb8' };
function rexGrid(legs, dead) {
  const rows = [...REX_BODY, ...REX_LEGS[legs]].map((r) => r.padEnd(22, '.'));
  if (dead) rows[4] = rows[4].replace('wk', 'kk');
  return rows;
}

const cache = new Map();
function gridCanvas(rows, pal = PAL, withOutline = true) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const g = newGrid(w + 2, h + 2);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && pal[ch]) g[y + 1][x + 1] = pal[ch]; }));
  return toCanvas(withOutline ? outline(g) : g);
}

export function avatarCanvas(avatar) {
  const a = normalizeAvatar(avatar), key = `a:${JSON.stringify(a)}`;
  if (!cache.has(key)) cache.set(key, drawPortrait(a));
  return cache.get(key);
}
export const avatarURL = (avatar) => {
  const key = `au:${JSON.stringify(normalizeAvatar(avatar))}`;
  if (!cache.has(key)) cache.set(key, avatarCanvas(avatar).toDataURL());
  return cache.get(key);
};

export function iconCanvas(name) {
  const key = `i:${name}`;
  if (!cache.has(key)) cache.set(key, gridCanvas(ICONS[name] || ICONS.star, PAL));
  return cache.get(key);
}
export const iconURL = (name) => {
  const key = `iu:${name}`;
  if (!cache.has(key)) cache.set(key, iconCanvas(name).toDataURL());
  return cache.get(key);
};
export const ICON_NAMES = Object.keys(ICONS);

export function rexCanvas(frame = 'a', dead = false) {
  const key = `rex:${frame}:${dead}`;
  if (!cache.has(key)) cache.set(key, gridCanvas(rexGrid(frame, dead), REX_PAL));
  return cache.get(key);
}
export const rexURL = (frame = 'stand', dead = false) => {
  const key = `rexu:${frame}:${dead}`;
  if (!cache.has(key)) cache.set(key, rexCanvas(frame, dead).toDataURL());
  return cache.get(key);
};

// A signal-bars icon with `lit` of 4 bars glowing. 0 lit = a dead (red) zone.
export function signalURL(lit, dead = false) {
  const key = `sig:${lit}:${dead}`;
  if (cache.has(key)) return cache.get(key);
  const bars = [[0, 7], [3, 5], [6, 3], [9, 0]]; // x, top row
  const rows = Array.from({ length: 9 }, () => Array(11).fill('.'));
  bars.forEach(([x, top], i) => {
    const ch = i < lit ? 'c' : dead ? 'r' : 's';
    for (let y = top; y < 9; y++) { rows[y][x] = ch; rows[y][x + 1] = ch; }
  });
  const url = gridCanvas(rows.map((r) => r.join(''))).toDataURL();
  cache.set(key, url);
  return url;
}
