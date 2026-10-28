// Saving a finished test. The server decides the carrier and the score; the phone only sends numbers.
import { Router } from 'express';
import crypto from 'node:crypto';
import { Room, Measurement } from '../models.js';
import { classifyIp } from '../carrier.js';
import { computeScore, validateMeasurement } from '../score.js';
import { istParts } from '../time.js';

export function hashDevice(device, salt) {
  return crypto.createHash('sha256').update(`${salt}:${device}`).digest('hex').slice(0, 32);
}

export function measurementsRouter({ config, lookup, campusList, io, game }) {
  const r = Router();

  r.post('/measurements', async (req, res) => {
    const { ok, errors, value } = validateMeasurement(req.body);
    if (!ok) return res.status(400).json({ error: 'Invalid test result', details: errors });

    const room = await Room.findById(value.roomId).lean();
    if (!room) return res.status(404).json({ error: `No room ${value.roomId}` });

    const device = hashDevice(value.device, config.deviceSalt);
    if (config.rateLimitSeconds > 0) {
      const since = new Date(Date.now() - config.rateLimitSeconds * 1000);
      const recent = await Measurement.exists({ device, roomId: room._id, createdAt: { $gte: since } });
      if (recent) {
        return res
          .status(429)
          .json({ error: `One test per room every ${config.rateLimitSeconds} seconds. Thanks for helping!` });
      }
    }

    const net = classifyIp(req.ip, lookup, campusList);
    const now = new Date();
    const { hour, dow } = istParts(now);
    // GAME: what this room looked like before this scan (first scan? new network? stale?)
    const history = game ? await game.roomHistory(room._id).catch(() => null) : null;
    const doc = await Measurement.create({
      roomId: room._id,
      buildingId: room.buildingId,
      floor: room.floor,
      carrier: net.carrier,
      asn: net.asn,
      connType: value.connType,
      downMbps: value.downMbps,
      upMbps: value.upMbps,
      latencyMs: value.latencyMs,
      jitterMs: value.jitterMs,
      lossPct: value.lossPct,
      score: computeScore(value),
      device,
      hour,
      dow,
      createdAt: now,
    });

    const event = {
      roomId: doc.roomId,
      buildingId: doc.buildingId,
      floor: doc.floor,
      carrier: doc.carrier,
      score: doc.score,
      at: doc.createdAt,
    };
    io?.emit('measurement:new', event);

    // GAME: XP, streaks, quests, badges. A game problem must never lose the saved test.
    let reward = null;
    if (game && history) {
      try {
        const out = await game.rewardScan({ device: value.device, roomId: room._id, carrier: net.carrier, score: doc.score, history, now });
        if (out) {
          reward = out.reward;
          io?.emit('game:event', { type: 'scan', nickname: out.player.nickname, team: out.player.team, roomId: room._id, roomName: room.name, xp: reward.xp, score: doc.score, rex: reward.rex, first: reward.firstInRoom, at: now });
        }
      } catch (err) {
        console.error('game reward failed', err);
      }
    }
    res.status(201).json({ ...event, id: doc._id, downMbps: doc.downMbps, upMbps: doc.upMbps, latencyMs: doc.latencyMs, jitterMs: doc.jitterMs, lossPct: doc.lossPct, reward });
  });

  return r;
}
