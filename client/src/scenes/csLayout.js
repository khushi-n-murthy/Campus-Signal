// CSE Dept walk-through: floor plan, furniture spots, where you can walk, and the signal estimate
// at any point. Pure maths (no React, no three.js) so it can be checked in Node.
//
// Building-local metres: x runs along the block (0 = west end), z across it (0 = north wall).
//
//   z=0  ┌──────┬────────┬────────┬────────┬────────┬────────┐  north windows
//        │stairs│ room 1 │ room 2 │ room 3 │ room 4 │ room 5 │
//        │ lift │  board │        │        │        │        │
//   z=7.4├      ┴──door──┴──door──┴──door──┴──door──┴──door──┤
//        │                    corridor                       │
//   z=11 └───────────────────────────────────────────────────┘  south windows
//
export const CS = {
  id: 'CSE',
  W: 50.9, // matches the CSE footprint in server/data/campus.json
  D: 11.0,
  floors: 3,
  ceiling: 3.2,
  eye: 1.6,
  roomDepth: 7.4, // rooms occupy z 0..7.4
  wall: 0.2, // corridor wall z 7.4..7.6
  coreW: 5.5, // stairs + lift at the west end
  roomW: 9.08,
};
export const CORRIDOR = { x0: 0, x1: CS.W, z0: CS.roomDepth + CS.wall, z1: CS.D };

// Room kinds per floor (ids match campus.json: CSE-001..005, CSE-101..105, CSE-201..205).
const PLAN = [
  ['classroom', 'lab', 'classroom', 'lab', 'seminar'],
  ['lab', 'classroom', 'lab', 'classroom', 'classroom'],
  ['classroom', 'lab', 'classroom', 'lab', 'lab'],
];
const LABEL = { classroom: 'Classroom', lab: 'Computer lab', seminar: 'Seminar hall' };

export function roomsOnFloor(floor) {
  return PLAN[floor].map((kind, i) => {
    const x0 = CS.coreW + i * CS.roomW;
    const x1 = x0 + CS.roomW;
    return {
      id: `CSE-${floor}0${i + 1}`,
      index: i,
      kind,
      label: LABEL[kind],
      x0,
      x1,
      z0: 0,
      z1: CS.roomDepth,
      door: { x: x1 - 1.4, w: 1.0 }, // door near the east end of each room's corridor wall
      cx: (x0 + x1) / 2,
      cz: CS.roomDepth / 2,
    };
  });
}

// Furniture inside one room, in building-local metres. Students face the board on the west wall.
export function roomFurniture(room) {
  const desks = [];
  if (room.kind === 'seminar') {
    // rows of chairs facing a lectern
    for (let x = room.x0 + 2.6; x <= room.x1 - 1.0; x += 1.0) {
      for (let z = 0.9; z <= room.z1 - 1.3; z += 0.75) {
        if (z > 3.2 && z < 4.2) continue; // centre aisle
        desks.push({ type: 'chairOnly', x, z });
      }
    }
    return { desks, board: { x: room.x0, z: room.cz, len: 4.2 }, teacher: { x: room.x0 + 1.3, z: room.cz - 2.4 } };
  }
  const lab = room.kind === 'lab';
  for (let x = room.x0 + 2.9; x <= room.x1 - 1.3; x += 2.0) {
    for (let z = 0.95; z <= room.z1 - 1.9; z += 1.5) { // leaves a back aisle in front of the door
      desks.push({ type: lab ? 'labDesk' : 'desk', x, z });
    }
  }
  return { desks, board: { x: room.x0, z: room.cz - 0.4, len: 3.6 }, teacher: { x: room.x0 + 1.4, z: room.cz + 1.6 } };
}

// Rectangles you cannot walk through (desks with their chairs), building-local.
function obstacles(floor) {
  const out = [];
  for (const r of roomsOnFloor(floor)) {
    const f = roomFurniture(r);
    for (const d of f.desks) {
      if (d.type === 'chairOnly') out.push([d.x - 0.25, d.z - 0.25, d.x + 0.25, d.z + 0.25]);
      else out.push([d.x - 0.4, d.z - 0.72, d.x + 0.95, d.z + 0.72]);
    }
    out.push([f.teacher.x - 0.85, f.teacher.z - 0.85, f.teacher.x + 0.85, f.teacher.z + 0.85]);
  }
  // stairs and lift shaft in the core
  out.push([0, 0, 2.7, CS.roomDepth]);
  out.push([2.7, 0, CS.coreW, 1.8]);
  return out;
}
const OBSTACLES = Array.from({ length: CS.floors }, (_, f) => obstacles(f));

const inRect = (x, z, [x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1;

// Can you stand here? Inside the corridor, a room, the open core, or a doorway — and not in furniture.
export function walkable(floor, x, z, margin = 0.32) {
  const m = margin;
  let inside = inRect(x, z, [m, CORRIDOR.z0 + m, CS.W - m, CS.D - m]); // corridor
  if (!inside && inRect(x, z, [m, m, CS.coreW - m, CORRIDOR.z0 + 0.01])) inside = true; // core (open to corridor)
  if (!inside) {
    for (const r of roomsOnFloor(floor)) {
      if (inRect(x, z, [r.x0 + CS.wall / 2 + m, m, r.x1 - CS.wall / 2 - m, r.z1 - m])) inside = true;
      else if (inRect(x, z, [r.door.x - r.door.w / 2 + 0.12, r.z1 - m - 0.05, r.door.x + r.door.w / 2 - 0.12, CORRIDOR.z0 + m + 0.05])) inside = true;
      if (inside) break;
    }
  }
  if (!inside) return false;
  return !OBSTACLES[floor].some((o) => inRect(x, z, [o[0] - 0.15, o[1] - 0.15, o[2] + 0.15, o[3] + 0.15]));
}

export function roomAt(floor, x, z) {
  return roomsOnFloor(floor).find((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) || null;
}

// ---------- signal estimate ----------
// roomScores: { [roomId]: { [carrier]: score } } from the measured tests in each room.
// Inside a room you get that room's numbers. In the corridor and core, values are blended from the
// rooms around you, weighted by how close their doors are (inverse-distance), so the estimate is
// honest about where it comes from: real tests, not a radio simulation.
export function signalAt(floor, roomScores, x, z) {
  const rooms = roomsOnFloor(floor);
  const here = roomAt(floor, x, z);
  if (here) {
    const s = roomScores[here.id];
    if (s && Object.keys(s).length) return { ...s };
  }
  const acc = {};
  const wsum = {};
  for (const r of rooms) {
    const s = roomScores[r.id];
    if (!s) continue;
    const dx = x - r.door.x;
    const dz = z - CORRIDOR.z0;
    const w = 1 / (dx * dx + dz * dz + 4);
    for (const [carrier, score] of Object.entries(s)) {
      if (score == null) continue;
      acc[carrier] = (acc[carrier] || 0) + score * w;
      wsum[carrier] = (wsum[carrier] || 0) + w;
    }
  }
  const out = {};
  for (const c of Object.keys(acc)) out[c] = Math.round(acc[c] / wsum[c]);
  return out;
}

// One number for the heatmap: the chosen network, or the best network when "All" is selected.
export function pickScore(scores, net) {
  if (!scores) return null;
  if (net && net !== 'All') return scores[net] ?? null;
  const vals = Object.values(scores).filter((v) => v != null);
  return vals.length ? Math.max(...vals) : null;
}

// Where you start: just inside the entrance at the west end of the corridor, looking east.
export const START = { x: 7.0, z: (CORRIDOR.z0 + CS.D) / 2, heading: 0 };

// Where "walk to this room" takes you: the middle of the room's back aisle, facing the board.
export const roomSpot = (room) => ({ x: room.cx, z: room.z1 - 0.75 });
