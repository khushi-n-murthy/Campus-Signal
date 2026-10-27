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
