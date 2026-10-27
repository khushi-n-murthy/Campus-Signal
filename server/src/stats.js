// Pure functions that turn a list of measurements into answers. No database code here,
// so every rule can be tested with plain arrays.

export function median(values) {
  const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

// How much to trust a number: depends on how many tests and how many different phones.
export function confidence(samples, devices) {
  if (samples >= 15 && devices >= 5) return 'high';
  if (samples >= 5 && devices >= 2) return 'medium';
  return 'low';
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return map;
}

// One row per network: medians of every metric + how far to trust them. Best network first.
export function summarizeByCarrier(measurements) {
  const rows = [];
  for (const [carrier, ms] of groupBy(measurements, (m) => m.carrier)) {
    const devices = new Set(ms.map((m) => m.device)).size;
    rows.push({
      carrier,
      score: round1(median(ms.map((m) => m.score))),
      downMbps: round1(median(ms.map((m) => m.downMbps))),
      upMbps: round1(median(ms.map((m) => m.upMbps))),
      latencyMs: round1(median(ms.map((m) => m.latencyMs))),
      jitterMs: round1(median(ms.map((m) => m.jitterMs))),
      lossPct: round1(median(ms.map((m) => m.lossPct))),
      samples: ms.length,
      devices,
      confidence: confidence(ms.length, devices),
      lastAt: ms.reduce((t, m) => (m.createdAt > t ? m.createdAt : t), ms[0].createdAt),
    });
  }
  return rows.sort((a, b) => b.score - a.score || b.samples - a.samples);
}

// The single colour for a room/building on the map.
// carrier given -> that network's median. No carrier -> the best network there ("can I get online here?").
export function headlineScore(measurements, carrier) {
  const rows = summarizeByCarrier(carrier ? measurements.filter((m) => m.carrier === carrier) : measurements);
  if (rows.length === 0) return { score: null, carrier: carrier || null, samples: 0, confidence: 'low' };
  const best = rows[0];
  return { score: best.score, carrier: best.carrier, samples: best.samples, confidence: best.confidence };
}

// For each network: 24 hourly buckets (IST) with the median score of tests taken in that hour.
export function forecastByHour(measurements) {
  const out = {};
  for (const [carrier, ms] of groupBy(measurements, (m) => m.carrier)) {
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, score: null, samples: 0 }));
    for (const [hour, hs] of groupBy(ms, (m) => m.hour)) {
      if (hour >= 0 && hour < 24) hours[hour] = { hour, score: round1(median(hs.map((m) => m.score))), samples: hs.length };
    }
    out[carrier] = hours;
  }
  return out;
}

// A dead zone = a room + network whose median stays under the threshold, backed by enough tests
// from enough different phones that it is not one unlucky reading.
export const DEAD_ZONE_RULE = { threshold: 30, minSamples: 15, minDevices: 5 };

export function deadZones(measurements, rule = DEAD_ZONE_RULE) {
  const zones = [];
  for (const [, ms] of groupBy(measurements, (m) => `${m.roomId}|${m.carrier}`)) {
    const score = median(ms.map((m) => m.score));
    const devices = new Set(ms.map((m) => m.device)).size;
    if (score < rule.threshold && ms.length >= rule.minSamples && devices >= rule.minDevices) {
      const badHours = [];
      for (const [hour, hs] of groupBy(ms, (m) => m.hour)) {
        if (median(hs.map((m) => m.score)) < rule.threshold) badHours.push(hour);
      }
      zones.push({
        roomId: ms[0].roomId,
        buildingId: ms[0].buildingId,
        floor: ms[0].floor,
        carrier: ms[0].carrier,
        score: round1(score),
        downMbps: round1(median(ms.map((m) => m.downMbps))),
        lossPct: round1(median(ms.map((m) => m.lossPct))),
        samples: ms.length,
        devices,
        badHours: badHours.sort((a, b) => a - b),
      });
    }
  }
  return zones.sort((a, b) => a.score - b.score || b.samples - a.samples);
}

// SIM Advisor. slots: [{ dow, hour, roomId }]. For each slot and network, use tests from that room
// within +/-1 hour of the slot (any weekday) when there are at least 3; otherwise fall back to the
// room's all-day median and say so. The network that wins the most slots is recommended.
export function advise(slots, measurements, { minNearby = 3 } = {}) {
  const byRoom = groupBy(measurements, (m) => m.roomId);
  const wins = {};
  const totals = {};
  const results = slots.map((slot) => {
    const ms = byRoom.get(slot.roomId) || [];
    const scores = {};
    for (const [carrier, cms] of groupBy(ms, (m) => m.carrier)) {
      const near = cms.filter((m) => Math.min(Math.abs(m.hour - slot.hour), 24 - Math.abs(m.hour - slot.hour)) <= 1);
      if (near.length >= minNearby) {
        scores[carrier] = { score: round1(median(near.map((m) => m.score))), basis: 'same time of day', samples: near.length };
      } else {
        scores[carrier] = { score: round1(median(cms.map((m) => m.score))), basis: 'all-day average', samples: cms.length };
      }
    }
    let best = null;
    for (const [carrier, s] of Object.entries(scores)) {
      if (!best || s.score > scores[best].score) best = carrier;
      totals[carrier] = (totals[carrier] || 0) + s.score;
    }
    if (best) wins[best] = (wins[best] || 0) + 1;
    return { ...slot, best, scores };
  });
  const ranking = Object.keys(totals).sort((a, b) => (wins[b] || 0) - (wins[a] || 0) || totals[b] - totals[a]);
  return {
    slots: results,
    wins,
    recommendation: ranking[0] || null,
    slotsWithData: results.filter((r) => r.best).length,
  };
}
