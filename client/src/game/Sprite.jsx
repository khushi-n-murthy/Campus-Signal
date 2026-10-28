// Small components that show pixel art. Everything is drawn crisp (no blur) at a whole-number scale.
import { useMemo } from 'react';
import { avatarURL, iconURL, rexURL, signalURL, CHAR_W, CHAR_H } from './pixel.js';

export function Avatar({ avatar, scale = 4, className = '', idle = false, label }) {
  const src = useMemo(() => avatarURL(avatar), [JSON.stringify(avatar)]); // eslint-disable-line react-hooks/exhaustive-deps
  return <img className={`px-img avatar ${idle ? 'idle' : ''} ${className}`} src={src} width={CHAR_W * scale} height={CHAR_H * scale} alt={label || ''} draggable="false" />;
}

const ICON_SIZE = { star: [11, 10], trophy: [11, 10], hourglass: [9, 9], clipboard: [9, 10], coin: [8, 8], bolt: [7, 8], crown: [11, 7], shield: [9, 10], fog: [7, 9], check: [9, 6], cactus: [9, 14], cactusLow: [9, 9], bug: [11, 8], bug2: [11, 8] };
export function Icon({ name, scale = 2, className = '', label }) {
  const [w, h] = ICON_SIZE[name] || [10, 10];
  return <img className={`px-img icon ${className}`} src={iconURL(name)} width={(w + 2) * scale} height={(h + 2) * scale} alt={label || ''} draggable="false" />;
}

export function Rex({ scale = 3, frame = 'stand', dead = false, className = '', label }) {
  return <img className={`px-img rex ${className}`} src={rexURL(frame, dead)} width={24 * scale} height={22 * scale} alt={label || ''} draggable="false" />;
}

export function SignalBars({ lit = 4, dead = false, scale = 2, className = '' }) {
  return <img className={`px-img ${className}`} src={signalURL(lit, dead)} width={13 * scale} height={11 * scale} alt="" draggable="false" />;
}

// 0-100 score -> how many of 4 bars light up.
export const barsFor = (score) => (score == null ? 0 : score >= 75 ? 4 : score >= 55 ? 3 : score >= 30 ? 2 : 1);
