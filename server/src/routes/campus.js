// Read-only views of the campus: buildings, floors, rooms, and their scores.
import { Router } from 'express';
import { Building, Room, Measurement } from '../models.js';
import { windowFilter, SUMMARY_FIELDS } from '../db.js';
import { headlineScore, summarizeByCarrier, forecastByHour } from '../stats.js';

function carrierParam(req) {
  const c = typeof req.query.carrier === 'string' ? req.query.carrier.trim() : '';
  return c && c.toLowerCase() !== 'all' ? c : null;
}

export function campusRouter(config) {
  const r = Router();

  // Every room, for pickers and the advisor form.
  r.get('/rooms', async (req, res) => {
    const rooms = await Room.find({}, 'buildingId floor name kind').sort({ buildingId: 1, floor: 1, _id: 1 }).lean();
    res.json(rooms);
  });

  // Campus view: each building with its headline score.
  r.get('/campus', async (req, res) => {
    const carrier = carrierParam(req);
    const [buildings, ms] = await Promise.all([
      Building.find().sort({ _id: 1 }).lean(),
      Measurement.find(windowFilter(config), SUMMARY_FIELDS).lean(),
    ]);
    const roomCounts = await Room.aggregate([{ $group: { _id: '$buildingId', n: { $sum: 1 } } }]);
    const countOf = Object.fromEntries(roomCounts.map((x) => [x._id, x.n]));
    res.json(
      buildings.map((b) => ({
        ...b,
        rooms: countOf[b._id] || 0,
        headline: headlineScore(ms.filter((m) => m.buildingId === b._id), carrier),
      })),
    );
  });

  // Building view: floors, each with its rooms and their headline scores.
  r.get('/buildings/:id', async (req, res) => {
    const id = req.params.id.toUpperCase();
    const carrier = carrierParam(req);
    const building = await Building.findById(id).lean();
    if (!building) return res.status(404).json({ error: `No building ${id}` });
    const [rooms, ms] = await Promise.all([
      Room.find({ buildingId: id }).sort({ floor: 1, _id: 1 }).lean(),
      Measurement.find(windowFilter(config, { buildingId: id }), SUMMARY_FIELDS).lean(),
    ]);
    const floors = Array.from({ length: building.floors }, (_, floor) => ({
      floor,
      rooms: rooms
        .filter((room) => room.floor === floor)
        .map((room) => ({ ...room, headline: headlineScore(ms.filter((m) => m.roomId === room._id), carrier) })),
    }));
    res.json({ ...building, headline: headlineScore(ms, carrier), floorsDetail: floors });
  });

  // Room view: every network's medians and confidence.
  r.get('/rooms/:id', async (req, res) => {
    const id = req.params.id.toUpperCase();
    const room = await Room.findById(id).lean();
    if (!room) return res.status(404).json({ error: `No room ${id}` });
    const [building, ms] = await Promise.all([
      Building.findById(room.buildingId).lean(),
      Measurement.find(windowFilter(config, { roomId: id }), SUMMARY_FIELDS).lean(),
    ]);
    res.json({ ...room, building, networks: summarizeByCarrier(ms), totalSamples: ms.length, windowDays: config.windowDays });
  });

  // Room "WiFi weather": median score per network for each hour of the day.
  r.get('/rooms/:id/forecast', async (req, res) => {
    const id = req.params.id.toUpperCase();
    const room = await Room.exists({ _id: id });
    if (!room) return res.status(404).json({ error: `No room ${id}` });
    const ms = await Measurement.find(windowFilter(config, { roomId: id }), 'carrier score hour').lean();
    res.json({ roomId: id, hours: forecastByHour(ms) });
  });

  return r;
}
