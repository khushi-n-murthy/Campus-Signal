// MongoDB collections, defined with Mongoose.
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// A building on the 3D campus. footprint = position and size in metres on the campus ground.
const buildingSchema = new Schema(
  {
    _id: { type: String, uppercase: true, trim: true }, // e.g. "A"
    name: { type: String, required: true },
    floors: { type: Number, required: true, min: 1, max: 30 },
    footprint: {
      x: { type: Number, required: true }, // centre, metres east of campus origin
      z: { type: Number, required: true }, // centre, metres south of campus origin
      w: { type: Number, required: true, min: 1 }, // width (east-west)
      d: { type: Number, required: true, min: 1 }, // depth (north-south)
    },
  },
  { versionKey: false },
);

// A room = one QR code. shape = rectangle on its floor plan, metres from the building's corner.
const roomSchema = new Schema(
  {
    _id: { type: String, uppercase: true, trim: true, match: /^[A-Z0-9_-]{1,40}$/ }, // printed in the QR
    buildingId: { type: String, required: true, uppercase: true, ref: 'Building' },
    floor: { type: Number, required: true, min: 0 },
    name: { type: String, required: true },
    kind: { type: String, enum: ['classroom', 'lab', 'library', 'canteen', 'office', 'corridor', 'other'], default: 'classroom' },
    shape: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      w: { type: Number, required: true, min: 1 },
      h: { type: Number, required: true, min: 1 },
    },
    // Optional: where WiFi access points really are, in metres inside the room (only if IT shares them).
    accessPoints: [{ _id: false, x: Number, y: Number }],
  },
  { versionKey: false },
);
roomSchema.index({ buildingId: 1, floor: 1 });

// One speed test. No names, phone numbers or IP addresses are stored.
const measurementSchema = new Schema(
  {
    roomId: { type: String, required: true },
    buildingId: { type: String, required: true },
    floor: { type: Number, required: true },
    carrier: { type: String, required: true },
    asn: { type: Number, default: null },
    connType: { type: String, default: 'unknown' },
    downMbps: { type: Number, required: true },
    upMbps: { type: Number, required: true },
    latencyMs: { type: Number, default: null },
    jitterMs: { type: Number, default: null },
    lossPct: { type: Number, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    device: { type: String, required: true }, // salted SHA-256 of a random id kept on the phone
    hour: { type: Number, required: true, min: 0, max: 23 }, // IST
    dow: { type: Number, required: true, min: 0, max: 6 }, // 0 = Sunday
    demo: { type: Boolean, default: false }, // true only for seeded practice data
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
measurementSchema.index({ roomId: 1, carrier: 1, createdAt: -1 });
measurementSchema.index({ device: 1, roomId: 1, createdAt: -1 });
measurementSchema.index({ createdAt: -1 });

export const Building = model('Building', buildingSchema);
export const Room = model('Room', roomSchema);
export const Measurement = model('Measurement', measurementSchema);

// ---------- the game ----------
// A player is a nickname + character on top of the same anonymous device id. No real names, no IPs.
const playerSchema = new Schema(
  {
    device: { type: String, required: true, unique: true }, // salted hash, same as measurements
    nickname: { type: String, required: true },
    nickLower: { type: String, required: true, unique: true },
    avatar: {
      body: Number, skin: Number, hairStyle: Number, hairColor: Number, outfit: Number, outfitColor: Number, accessory: Number,
    },
    team: { type: String, default: null }, // the network they last tested on
    xp: { type: Number, default: 0 },
    scans: { type: Number, default: 0 },
    rexSightings: { type: Number, default: 0 },
    roomsSeen: { type: [String], default: [] },
    streak: { type: Number, default: 0 },
    lastDay: { type: String, default: null },
    dinoBest: { type: Number, default: 0 },
    badges: { type: [String], default: [] },
    daily: {
      day: String, scans: Number, rooms: [String], newRooms: Number, dinoXp: Number, bestRun: Number, quests: [String],
    },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
playerSchema.index({ xp: -1 });

// Best Rex run per player per room.
const runSchema = new Schema(
  {
    roomId: { type: String, required: true },
    device: { type: String, required: true },
    nickname: { type: String, required: true },
    distance: { type: Number, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
runSchema.index({ roomId: 1, device: 1 }, { unique: true });
runSchema.index({ roomId: 1, distance: -1 });

export const Player = model('Player', playerSchema);
export const Run = model('Run', runSchema);

// Every time Rex's Lair opened: by a weak scan ('auto'), a dead-zone button ('manual') or no connection ('offline').
const rexEventSchema = new Schema(
  {
    roomId: { type: String, default: null },
    device: { type: String, required: true },
    kind: { type: String, enum: ['auto', 'manual', 'offline'], required: true },
    played: { type: Boolean, default: false }, // false = the player pressed End without running
    at: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
rexEventSchema.index({ roomId: 1, at: -1 });
export const RexEvent = model('RexEvent', rexEventSchema);
