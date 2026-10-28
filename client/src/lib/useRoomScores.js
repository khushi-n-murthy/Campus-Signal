// Per-network scores for a set of rooms: { [roomId]: { [carrier]: score } }, plus each room's details.
// Used by the CSE walk-through, where the signal around you is blended from the rooms nearby.
import { useEffect, useState } from 'react';
import { getJSON } from './api.js';

export function useRoomScores(ids, version = 0) {
  const key = ids.join(',');
  const [state, setState] = useState({ key: null, scores: {}, details: {} });
  useEffect(() => {
    if (!key) return undefined;
    const ctrl = new AbortController();
    Promise.all(
      key.split(',').map((id) =>
        getJSON(`/api/rooms/${encodeURIComponent(id)}`, { signal: ctrl.signal }).catch((err) => {
          if (err.name === 'AbortError') throw err;
          return null; // one missing room must not blank the whole floor
        }),
      ),
    )
      .then((rooms) => {
        const scores = {};
        const details = {};
        for (const r of rooms) {
          if (!r) continue;
          details[r._id] = r;
          const s = {};
          for (const n of r.networks || []) {
            if (n.carrier !== 'Local network' && n.score != null) s[n.carrier] = n.score;
          }
          if (Object.keys(s).length) scores[r._id] = s;
        }
        setState({ key, scores, details });
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [key, version]);
  const current = state.key === key;
  return { scores: current ? state.scores : {}, details: current ? state.details : {}, loading: !current };
}
