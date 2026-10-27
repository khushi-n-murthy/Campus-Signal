// The endpoints a phone talks to during a test: who am I, ping, download, upload.
import { Router } from 'express';
import express from 'express';
import crypto from 'node:crypto';
import { classifyIp } from '../carrier.js';

const MiB = 1024 * 1024;
// Four different 1 MiB blocks of random bytes. Random data cannot be compressed by a
// network proxy, so the measured speed is the real speed.
const BLOCKS = Array.from({ length: 4 }, () => crypto.randomBytes(MiB));
export const MAX_DOWNLOAD_MB = 16;
export const MAX_UPLOAD_BYTES = 8 * MiB;

const NO_CACHE = { 'Cache-Control': 'no-store, no-transform', Pragma: 'no-cache' };

export function speedtestRouter({ lookup, campusList }) {
  const r = Router();

  r.get('/whoami', (req, res) => {
    const info = classifyIp(req.ip, lookup, campusList);
    res.set(NO_CACHE).json(info); // the caller's own IP is shown back to them, never stored
  });

  r.get('/ping', (req, res) => {
    res.set(NO_CACHE).status(204).end();
  });

  r.get('/dl', (req, res) => {
    const requested = Number.parseInt(req.query.mb, 10);
    const mb = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), MAX_DOWNLOAD_MB) : 4;
    res.set({ ...NO_CACHE, 'Content-Type': 'application/octet-stream', 'Content-Length': String(mb * MiB) });
    let sent = 0;
    const pump = () => {
      while (sent < mb) {
        const block = BLOCKS[sent % BLOCKS.length];
        sent += 1;
        if (!res.write(block)) {
          res.once('drain', pump);
          return;
        }
      }
      res.end();
    };
    res.on('close', () => {
      sent = mb; // phone stopped early: stop sending
    });
    pump();
  });

  r.post('/ul', express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }), (req, res) => {
    res.set(NO_CACHE).status(204).end();
  });

  return r;
}
