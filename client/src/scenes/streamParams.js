// How measured numbers become motion in the signal streams. Pure, so it can be tested in Node.

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
const CONFIDENCE_OPACITY = { high: 1, medium: 0.75, low: 0.4 };

// The pure mapping from numbers to motion, exported so it can be checked without a GPU.
export function streamParams(net) {
  return {
    speed: 0.05 + 0.3 * clamp01((net.downMbps ?? 0) / 40), // curve lengths per second
    wobble: 0.02 + 0.3 * clamp01((net.jitterMs ?? 100) / 80), // metres
    deathChance: Math.min(0.85, (net.lossPct ?? 0) / 15), // share of particles that die mid-flight
    opacity: CONFIDENCE_OPACITY[net.confidence] ?? 0.4,
  };
}
