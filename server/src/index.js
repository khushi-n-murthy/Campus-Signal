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

const asn = await openAsnDatabase();
console.log('GeoLite2-ASN database ready');

const { httpServer, io } = createApp({ config, lookup: asn.lookup });
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
  asn.close();
  await disconnectDb();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
