// Loads data/campus.json into MongoDB. Safe to run again after editing the file.
// node scripts/seed-campus.js          -> insert/update buildings and rooms
// node scripts/seed-campus.js --prune  -> also delete rooms/buildings that are no longer in the file
import { config, configProblems } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { Building, Room } from '../src/models.js';
import { loadCampusFile, validateCampus } from '../src/campusData.js';

const problems = configProblems();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const { errors, warnings, buildings, rooms } = validateCampus(loadCampusFile());
for (const w of warnings) console.warn('warning:', w);
if (errors.length) {
  console.error('campus.json has errors, nothing was written:\n - ' + errors.join('\n - '));
  process.exit(1);
}

await connectDb(config.mongoUri, config.dbName);
for (const b of buildings) await Building.replaceOne({ _id: b._id }, b, { upsert: true, runValidators: true });
for (const r of rooms) await Room.replaceOne({ _id: r._id }, r, { upsert: true, runValidators: true });
if (process.argv.includes('--prune')) {
  const del = await Room.deleteMany({ _id: { $nin: rooms.map((r) => r._id) } });
  const delB = await Building.deleteMany({ _id: { $nin: buildings.map((b) => b._id) } });
  console.log(`Pruned ${del.deletedCount} rooms and ${delB.deletedCount} buildings`);
}
console.log(`Seeded ${buildings.length} buildings and ${rooms.length} rooms into "${config.dbName}"`);
await disconnectDb();
