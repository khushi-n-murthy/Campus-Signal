// Starts CampusSignal: connect to MongoDB, open the ASN database, listen.
import os from 'node:os';
import { config, configProblems } from './config.js';
import { connectDb, disconnectDb } from './db.js';
import { openAsnDatabase } from './asn.js';
import { createApp } from './app.js';

const problems = configProblems();
if (problems.length) {
  console.error('Fix server/.env first:\n - ' + problems.join('\n - '));
  process.exit(1);
}

await connectDb(config.mongoUri, config.dbName);
console.log(`MongoDB connected (database "${config.dbName}")`);

// The ASN database tells phones' networks apart (Jio, Airtel, ...). It is downloaded on first run. Some networks
// block that download (raw.githubusercontent.com), and the library then waits forever instead of failing, so give
// it a time limit and start anyway: carriers show as "Other" until the database arrives (it keeps retrying, and
// switches on by itself if a later attempt succeeds). Local testing never needs it: local IPs are "Local network".
let asn = null;
const asnPending = openAsnDatabase().then((db) => {
  asn = db;
  return db;
});
asnPending.catch(() => {}); // a late failure must not crash the running server
const ASN_WAIT_MS = 20000;
const ready = await Promise.race([asnPending.then(() => true, () => false), new Promise((r) => setTimeout(() => r(false), ASN_WAIT_MS))]);
if (ready) {
  console.log('GeoLite2-ASN database ready');
} else {
  console.warn('GeoLite2-ASN database not available yet (download blocked or slow). Starting without it: networks show as "Other".');
  console.warn('To fix: run "npm run preload" on a network that can reach raw.githubusercontent.com, then restart.');
  asnPending.then(() => console.log('GeoLite2-ASN database ready (arrived late): network detection is on.'), () => {});
}
// Always hand the app a lookup; it answers once the database is loaded. `ready` tells /api/health the truth.
const lookup = (ip) => (asn ? asn.lookup(ip) : null);
Object.defineProperty(lookup, 'ready', { get: () => Boolean(asn) });

const { httpServer, io } = createApp({ config, lookup });
httpServer.listen(config.port, '0.0.0.0', () => {
  console.log(`CampusSignal running on http://localhost:${config.port}`);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  same-WiFi phones: http://${a.address}:${config.port}`);
    }
  }
});

async function shutdown() {
  io.close();
  httpServer.close();
  asn?.close();
  await disconnectDb();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);