// Turns one test's raw numbers into a 0-100 quality score, and validates incoming results.

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Weights: download 50%, latency 25%, jitter 15%, packet loss 10%.
// A missing latency/jitter (every ping lost) counts as the worst value.
export function computeScore({ downMbps, latencyMs, jitterMs, lossPct }) {
  const D = clamp(downMbps / 25, 0, 1); // 25 Mbps or more = full marks
  const L = latencyMs == null ? 0 : clamp((400 - latencyMs) / 350, 0, 1); // <=50 ms full, >=400 ms zero
  const J = jitterMs == null ? 0 : clamp((100 - jitterMs) / 90, 0, 1); // <=10 ms full, >=100 ms zero
  const P = clamp(1 - lossPct / 10, 0, 1); // 0% full, >=10% zero
  return Math.round(100 * (0.5 * D + 0.25 * L + 0.15 * J + 0.1 * P));
}

export const CONN_TYPES = ['wifi', 'cellular', 'ethernet', 'other', 'unknown'];

function num(value, name, lo, hi, errors, { nullable = false } = {}) {
  if (value === null || value === undefined) {
    if (nullable) return null;
    errors.push(`${name} is required`);
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${name} must be a number`);
    return undefined;
  }
  if (value < lo || value > hi) {
    errors.push(`${name} must be between ${lo} and ${hi}`);
    return undefined;
  }
  return value;
}

// Returns { ok, errors, value }. Never trusts the client for carrier or score.
export function validateMeasurement(body) {
  const errors = [];
  const b = body && typeof body === 'object' ? body : {};
  const roomId = typeof b.roomId === 'string' ? b.roomId.trim().toUpperCase() : '';
  if (!/^[A-Z0-9_-]{1,40}$/.test(roomId)) errors.push('roomId must be 1-40 letters, digits, _ or -');
  const device = typeof b.device === 'string' ? b.device : '';
  if (device.length < 8 || device.length > 100) errors.push('device must be a string of 8-100 characters');

  const value = {
    roomId,
    device,
    downMbps: num(b.downMbps, 'downMbps', 0, 5000, errors),
    upMbps: num(b.upMbps, 'upMbps', 0, 5000, errors),
    latencyMs: num(b.latencyMs, 'latencyMs', 0, 10000, errors, { nullable: true }),
    jitterMs: num(b.jitterMs, 'jitterMs', 0, 10000, errors, { nullable: true }),
    lossPct: num(b.lossPct, 'lossPct', 0, 100, errors),
    connType: CONN_TYPES.includes(b.connType) ? b.connType : 'unknown',
  };
  if (value.lossPct !== undefined && value.lossPct < 100 && value.latencyMs === null) {
    errors.push('latencyMs can only be empty when every ping was lost (lossPct = 100)');
  }
  return { ok: errors.length === 0, errors, value };
}
