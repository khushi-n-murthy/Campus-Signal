// "WiFi weather": one bar per hour of the college day, coloured by that hour's median score.
import { useState } from 'react';
import { scoreHex, NO_DATA } from '../lib/colors.js';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8:00 to 19:00
const label = (h) => (h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`);

export function ForecastStrip({ hours }) {
  const carriers = Object.keys(hours || {});
  const [pick, setPick] = useState(null);
  const carrier = carriers.includes(pick) ? pick : carriers[0];
  if (!carrier) return <p className="muted">No tests yet, so no forecast.</p>;
  const row = hours[carrier];
  return (
    <div className="forecast">
      <div className="chips small">
        {carriers.map((c) => (
          <button key={c} type="button" className={c === carrier ? 'chip on' : 'chip'} onClick={() => setPick(c)}>
            {c}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 240 70" role="img" aria-label={`Hourly forecast for ${carrier}`}>
        {HOURS.map((h, i) => {
          const s = row[h]?.score;
          const height = s == null ? 4 : 6 + (s / 100) * 44;
          return (
            <g key={h}>
              <rect x={i * 20 + 3} y={54 - height} width={14} height={height} rx={3} fill={s == null ? NO_DATA : scoreHex(s)} opacity={s == null ? 0.4 : 1}>
                <title>{`${h}:00 — ${s == null ? 'no data' : `score ${s} (${row[h].samples} tests)`}`}</title>
              </rect>
              <text x={i * 20 + 10} y={66} textAnchor="middle" fontSize="7" fill="currentColor">
                {label(h)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
