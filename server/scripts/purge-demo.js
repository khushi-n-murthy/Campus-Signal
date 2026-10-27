// Deletes every practice measurement (demo: true). Real measurements are never touched.
import { config } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { Measurement } from '../src/models.js';

await connectDb(config.mongoUri, config.dbName);
const { deletedCount } = await Measurement.deleteMany({ demo: true });
console.log(`Deleted ${deletedCount} practice measurements`);
await disconnectDb();
