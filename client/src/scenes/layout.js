// Pure room-layout maths (no React, no three.js), so it can be tested in Node.

export const ROOM_HEIGHT = 3.2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function roomSize(room) {
  return { width: clamp(room.shape.w, 6, 30), depth: clamp(room.shape.h, 5, 30) };
}

// Where desks go: rows facing the board on the left wall. Pure function so it can be checked.
export function deskLayout(width, depth, kind, max = 48) {
  const spots = [];
  if (kind === 'canteen') {
    for (let x = -width / 2 + 2; x <= width / 2 - 1.5; x += 2.6) {
      for (let z = -depth / 2 + 2; z <= depth / 2 - 1.5; z += 2.2) spots.push({ x, z, rotation: 0, chairs: 'both' });
    }
  } else {
    const startX = -width / 2 + (kind === 'library' ? 2 : 3.2); // leave room for the teacher's desk
    for (let x = startX; x <= width / 2 - 1.2; x += 1.8) {
      for (let z = -depth / 2 + 1.6; z <= depth / 2 - 1; z += 1.5) spots.push({ x, z, rotation: Math.PI / 2, chairs: 'one' });
    }
  }
  return spots.slice(0, max);
}
