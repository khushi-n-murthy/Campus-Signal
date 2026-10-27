// The "creative layer": SIM Advisor and dead-zone reports for IT.
import { Router } from 'express';
import { Room, Measurement } from '../models.js';
import { windowFilter, SUMMARY_FIELDS } from '../db.js';
import { advise, deadZones, DEAD_ZONE_RULE } from '../stats.js';

export function insightsRouter(config) {
  const r = Router();

  // body: { slots: [{ dow: 1, hour: 9, roomId: "A-101" }, ...] }
  r.post('/advisor', async (req, res) => {
    const slots = Array.isArray(req.body?.slots) ? req.body.slots : null;
    if (!slots || slots.length === 0 || slots.length > 80) {
      return res.status(400).json({ error: 'Send 1-80 timetable slots as { slots: [{ dow, hour, roomId }] }' });
    }
    const clean = [];
    for (const [i, s] of slots.entries()) {
      const dow = Number(s?.dow);
      const hour = Number(s?.hour);
      const roomId = String(s?.roomId || '').toUpperCase();
      if (!Number.isInteger(dow) || dow < 0 || dow > 6 || !Number.isInteger(hour) || hour < 0 || hour > 23 || !roomId) {
        return res.status(400).json({ error: `Slot ${i + 1} needs dow 0-6, hour 0-23 and a roomId` });
      }
      clean.push({ dow, hour, roomId });
    }
    const roomIds = [...new Set(clean.map((s) => s.roomId))];
    const known = await Room.find({ _id: { $in: roomIds } }, '_id').lean();
    const missing = roomIds.filter((id) => !known.some((k) => k._id === id));
    if (missing.length) return res.status(404).json({ error: `Unknown room(s): ${missing.join(', ')}` });

    const ms = await Measurement.find(windowFilter(config, { roomId: { $in: roomIds } }), SUMMARY_FIELDS).lean();
    res.json(advise(clean, ms));
  });

  r.get('/admin/deadzones', async (req, res) => {
    const ms = await Measurement.find(windowFilter(config), SUMMARY_FIELDS).lean();
    res.json({ rule: DEAD_ZONE_RULE, windowDays: config.windowDays, zones: deadZones(ms) });
  });

  return r;
}
