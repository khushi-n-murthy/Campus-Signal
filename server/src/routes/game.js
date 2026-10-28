// The game API: explorer profile, leaderboard, room states, and Rex runs.
// The raw device id arrives in the `x-device` header (GET) or in the body (POST); only its salted hash is stored.
import { Router } from 'express';
import { windowFilter } from '../db.js';
import { classifyIp } from '../carrier.js';

export function gameRouter({ config, lookup, campusList, io, game }) {
  const r = Router();
  const device = (req) => (typeof req.get('x-device') === 'string' ? req.get('x-device') : req.body?.device);
  const reply = (res, out) => res.status(out.status).json(out.status >= 400 ? { error: out.error, details: out.details } : out);

  // Who am I? (404 = no explorer yet) plus the network the server sees, for the team badge.
  r.get('/game/me', async (req, res) => {
    const player = await game.me(req.get('x-device'));
    const net = classifyIp(req.ip, lookup, campusList);
    if (!player) return res.status(404).json({ error: 'No explorer on this phone yet.', carrier: net.carrier });
    res.json({ player, carrier: net.carrier });
  });

  r.post('/game/profile', async (req, res) => {
    const net = classifyIp(req.ip, lookup, campusList);
    const out = await game.createProfile({ device: req.body?.device, nickname: req.body?.nickname, avatar: req.body?.avatar, carrier: net.carrier });
    reply(res, out);
  });

  r.put('/game/profile', async (req, res) => reply(res, await game.updateAvatar({ device: device(req), avatar: req.body?.avatar })));

  r.get('/game/leaderboard', async (req, res) => res.json(await game.leaderboard(20)));

  r.get('/game/rooms-state', async (req, res) => res.json(await game.roomsState(() => windowFilter(config))));

  r.get('/game/room/:id', async (req, res) => {
    const id = req.params.id.toUpperCase();
    const detail = await game.roomDetail(id, (extra = {}) => windowFilter(config, extra));
    if (!detail) return res.status(404).json({ error: `No room ${id}` });
    res.json(detail);
  });

  r.post('/game/runs', async (req, res) => {
    const out = await game.recordRun({ device: req.body?.device, body: req.body });
    if (out.status === 201 && io) io.emit('game:event', { type: 'run', nickname: out.player.nickname, roomId: req.body?.roomId ?? null, distance: req.body?.distance, xp: out.reward.xp, at: new Date() });
    reply(res, out);
  });

  // Rex's Lair opened / closed. Guests count too.
  r.post('/game/rex-open', async (req, res) => reply(res, await game.rexOpen({ device: device(req), roomId: req.body?.roomId, kind: req.body?.kind })));
  r.post('/game/rex-close', async (req, res) => reply(res, await game.rexClose({ device: device(req), id: req.body?.id, played: req.body?.played })));

  return r;
}
