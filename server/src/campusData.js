// Checks data/campus.json before it goes into the database. Errors block seeding; warnings don't.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const CAMPUS_FILE = path.resolve(here, '../data/campus.json');

export function loadCampusFile(file = CAMPUS_FILE) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const EPS = 1e-6;

export function validateCampus(data) {
  const errors = [];
  const warnings = [];
  const buildings = Array.isArray(data?.buildings) ? data.buildings : [];
  const rooms = Array.isArray(data?.rooms) ? data.rooms : [];
  if (!buildings.length) errors.push('No buildings in campus.json');
  if (!rooms.length) errors.push('No rooms in campus.json');

  const byId = new Map();
  for (const b of buildings) {
    if (!b._id || !/^[A-Z0-9_-]{1,20}$/.test(b._id)) errors.push(`Building id "${b._id}" must be 1-20 capital letters/digits/_/-`);
    if (byId.has(b._id)) errors.push(`Building id "${b._id}" is used twice`);
    byId.set(b._id, b);
    if (!Number.isInteger(b.floors) || b.floors < 1) errors.push(`Building ${b._id}: floors must be a whole number >= 1`);
    const f = b.footprint || {};
    if (![f.x, f.z, f.w, f.d].every(Number.isFinite) || f.w <= 0 || f.d <= 0) errors.push(`Building ${b._id}: footprint needs x, z, w > 0, d > 0`);
  }
  const bs = [...byId.values()];
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i].footprint, c = bs[j].footprint;
      if (!a || !c) continue;
      const ra = { x: a.x - a.w / 2, y: a.z - a.d / 2, w: a.w, h: a.d };
      const rc = { x: c.x - c.w / 2, y: c.z - c.d / 2, w: c.w, h: c.d };
      if (overlaps(ra, rc)) warnings.push(`Buildings ${bs[i]._id} and ${bs[j]._id} overlap on the campus map`);
    }
  }

  const roomIds = new Set();
  for (const r of rooms) {
    const where = `Room ${r._id}`;
    if (!r._id || !/^[A-Z0-9_-]{1,40}$/.test(r._id)) errors.push(`Room id "${r._id}" must be 1-40 capital letters/digits/_/- (it is printed in the QR)`);
    if (roomIds.has(r._id)) errors.push(`Room id "${r._id}" is used twice`);
    roomIds.add(r._id);
    const b = byId.get(r.buildingId);
    if (!b) {
      errors.push(`${where}: building "${r.buildingId}" does not exist`);
      continue;
    }
    if (!Number.isInteger(r.floor) || r.floor < 0 || r.floor >= b.floors) {
      errors.push(`${where}: floor ${r.floor} is outside building ${b._id} (floors 0-${b.floors - 1})`);
    }
    if (!r.name) errors.push(`${where}: missing name`);
    const s = r.shape || {};
    if (![s.x, s.y, s.w, s.h].every(Number.isFinite) || s.w <= 0 || s.h <= 0) {
      errors.push(`${where}: shape needs x, y, w > 0, h > 0`);
      continue;
    }
    if (s.x < -EPS || s.y < -EPS || s.x + s.w > b.footprint.w + EPS || s.y + s.h > b.footprint.d + EPS) {
      errors.push(`${where}: shape goes outside building ${b._id} (${b.footprint.w} x ${b.footprint.d} m)`);
    }
  }
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], c = rooms[j];
      if (a.buildingId === c.buildingId && a.floor === c.floor && a.shape && c.shape && overlaps(a.shape, c.shape)) {
        warnings.push(`Rooms ${a._id} and ${c._id} overlap on floor ${a.floor}`);
      }
    }
  }
  for (const b of bs) {
    for (let f = 0; f < (b.floors || 0); f++) {
      if (!rooms.some((r) => r.buildingId === b._id && r.floor === f)) warnings.push(`Building ${b._id} floor ${f} has no rooms`);
    }
  }
  return { errors, warnings, buildings, rooms };
}
