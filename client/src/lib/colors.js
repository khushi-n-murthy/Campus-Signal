// One colour language for the whole site: blue = strong, amber = weak, red = dead, grey = no data.
// Plain hex strings here (no three.js), so the light test page does not have to load the 3D library.

const STOPS = [
  [0, '#ff3b5c'],
  [30, '#ff8a3d'],
  [55, '#ffd23f'],
  [75, '#3ddcff'],
  [100, '#4f7dff'],
];
export const NO_DATA = '#7d8799';

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export function scoreHex(score) {
  if (score == null || Number.isNaN(score)) return NO_DATA;
  const s = Math.min(100, Math.max(0, score));
  for (let i = 1; i < STOPS.length; i++) {
    const [s1, c1] = STOPS[i];
    if (s <= s1) {
      const [s0, c0] = STOPS[i - 1];
      const t = (s - s0) / (s1 - s0);
      const a = toRgb(c0);
      const b = toRgb(c1);
      return toHex(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return STOPS[STOPS.length - 1][1];
}

export function scoreWord(score) {
  if (score == null) return 'No data yet';
  if (score >= 75) return 'Strong';
  if (score >= 55) return 'Good';
  if (score >= 30) return 'Weak';
  return 'Dead zone';
}

export const LEGEND = STOPS.map(([s, c]) => ({ score: s, color: c }));

// Network names in the filter bar, in order.
export const NETWORKS = ['All', 'Jio', 'Airtel', 'Vi', 'BSNL', 'Campus WiFi'];
