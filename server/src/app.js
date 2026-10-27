// Builds the Express app + Socket.io server. index.js starts it; the verify scripts start it too.
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server as SocketServer } from 'socket.io';
import { buildCampusList } from './carrier.js';
import { dbIsUp } from './db.js';
import { speedtestRouter } from './routes/speedtest.js';
import { measurementsRouter } from './routes/measurements.js'; // add in Phase 4
import { campusRouter } from './routes/campus.js'; // add in Phase 5
import { insightsRouter } from './routes/insights.js'; // add in Phase 5

const here = path.dirname(fileURLToPath(import.meta.url));
export const CLIENT_DIST = path.resolve(here, '../../client/dist');

export function createApp({ config, lookup }) {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new SocketServer(httpServer, {
    cors: process.env.CLIENT_ORIGIN ? { origin: process.env.CLIENT_ORIGIN } : undefined,
  });
  const campusList = config.campusCidrs.length ? buildCampusList(config.campusCidrs) : null;

  const trust = config.trustProxy;
  app.set('trust proxy', /^\d+$/.test(trust) ? Number(trust) : trust === 'true' ? true : trust);
  app.disable('x-powered-by');

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, db: dbIsUp(), asnDatabase: Boolean(lookup), practiceData: config.includeDemo });
  });

  // Speed-test routes come before express.json so uploads are never parsed as JSON.
  app.use('/api', speedtestRouter({ lookup, campusList }));
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', measurementsRouter({ config, lookup, campusList, io })); // add in Phase 4
  app.use('/api', campusRouter(config)); // add in Phase 5
  app.use('/api', insightsRouter(config)); // add in Phase 5

  app.use('/api', (req, res) => res.status(404).json({ error: `No API route ${req.method} ${req.path}` }));

  // In production the built 3D site is served from the same server (same origin = no CORS issues).
  if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || path.extname(req.path)) return next(); // missing files stay 404
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    const message =
      err.type === 'entity.too.large'
        ? 'Upload too large'
        : err.type === 'entity.parse.failed'
          ? 'Body is not valid JSON'
          : status >= 500
            ? 'Server error'
            : err.message;
    res.status(status).json({ error: message });
  });

  return { app, httpServer, io };
}
