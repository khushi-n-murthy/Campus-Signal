// Phase 1: MongoDB reachable, campus.json valid, and the seeded data matches the file.
import mongoose from 'mongoose';
import { title, section, check, warn, finish, expectEqual } from './lib.js';
import { config } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { Building, Room, Measurement } from '../src/models.js';
import { loadCampusFile, validateCampus } from '../src/campusData.js';

title(1, 'Database and campus data', 'MongoDB works, your campus layout has no mistakes, and the database holds exactly that layout.');

section('Layout checker self-test (feeds it known mistakes)');
const base = () => ({
  buildings: [{ _id: 'T', name: 'Test', floors: 2, footprint: { x: 0, z: 0, w: 20, d: 10 } }],
  rooms: [
    { _id: 'T-001', buildingId: 'T', floor: 0, name: 'One', shape: { x: 0, y: 0, w: 10, h: 6 } },
    { _id: 'T-101', buildingId: 'T', floor: 1, name: 'Two', shape: { x: 0, y: 0, w: 10, h: 6 } },
  ],
});
const errorsFor = (mutate) => {
  const d = base();
  mutate(d);
  return validateCampus(d);
};
await check('A correct layout has no errors', () => expectEqual(errorsFor(() => {}).errors, []));
await check('Catches a room sticking out of its building', () => errorsFor((d) => { d.rooms[0].shape.x = 15; }).errors.length === 1);
await check('Catches a room on a floor that does not exist', () => errorsFor((d) => { d.rooms[1].floor = 2; }).errors.length === 1);
await check('Catches a duplicate room id', () => errorsFor((d) => { d.rooms[1]._id = 'T-001'; }).errors.length === 1);
await check('Catches a room in a building that does not exist', () => errorsFor((d) => { d.rooms[0].buildingId = 'Q'; }).errors.length === 1);
await check('Catches a lower-case room id (QR ids must be capitals)', () => errorsFor((d) => { d.rooms[0]._id = 't-001'; }).errors.length === 1);
await check('Warns (not errors) on overlapping rooms', () => {
  const r = errorsFor((d) => { d.rooms[1].floor = 0; d.rooms[1].shape.x = 5; });
  return r.errors.length === 0 && r.warnings.some((w) => w.includes('overlap'));
});

section('campus.json');
let data;
await check('campus.json is valid JSON', () => {
  data = loadCampusFile();
  return true;
}, 'Look for a missing comma or quote near the line the error mentions');
let result = { errors: ['not loaded'], warnings: [], buildings: [], rooms: [] };
if (data) result = validateCampus(data);
await check('campus.json has no layout errors', () => {
  if (result.errors.length) throw new Error(result.errors.join(' | '));
  return `${result.buildings.length} buildings, ${result.rooms.length} rooms`;
}, 'Fix each listed room/building in data/campus.json');
for (const w of result.warnings) warn(w);

section('MongoDB');
const connected = await check('Connects to MongoDB', async () => {
  await connectDb(config.mongoUri, config.dbName);
  await mongoose.connection.db.admin().ping();
  return `database "${config.dbName}"`;
}, 'Is mongod running (local) or is your IP allowed in Atlas > Network Access? Check MONGODB_URI in .env');

if (connected) {
  await check('Database version supports everything used', async () => {
    const info = await mongoose.connection.db.admin().serverInfo();
    const major = Number(info.version.split('.')[0]);
    if (major < 5) throw new Error(`MongoDB ${info.version} is too old`);
    return `MongoDB ${info.version}`;
  }, 'Use MongoDB 6 or newer (Atlas free tier is fine)');

  section('Seeded data (run npm run seed:campus first)');
  const [bCount, rCount] = await Promise.all([Building.countDocuments(), Room.countDocuments()]);
  await check('Every building in campus.json is in the database', async () => {
    const ids = (await Building.find({}, '_id').lean()).map((b) => b._id);
    const missing = result.buildings.filter((b) => !ids.includes(b._id)).map((b) => b._id);
    if (missing.length) throw new Error(`missing: ${missing.join(', ')}`);
    return `${bCount} in DB`;
  }, 'Run: npm run seed:campus');
  await check('Every room in campus.json is in the database', async () => {
    const ids = new Set((await Room.find({}, '_id').lean()).map((r) => r._id));
    const missing = result.rooms.filter((r) => !ids.has(r._id)).map((r) => r._id);
    if (missing.length) throw new Error(`missing: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`);
    return `${rCount} in DB`;
  }, 'Run: npm run seed:campus');
  if (rCount > result.rooms.length) warn(`The database has ${rCount - result.rooms.length} room(s) not in campus.json. Run npm run seed:campus -- --prune to remove them.`);
  await check('Every room points at a building that exists', async () => {
    const orphans = await Room.find({ buildingId: { $nin: await Building.distinct('_id') } }, '_id').lean();
    if (orphans.length) throw new Error(orphans.map((o) => o._id).join(', '));
    return true;
  }, 'Fix buildingId in campus.json and seed again');
  await check('Measurement indexes exist (fast queries)', async () => {
    const idx = await Measurement.collection.indexes();
    const names = idx.map((i) => Object.keys(i.key).join('+'));
    for (const need of ['roomId+carrier+createdAt', 'device+roomId+createdAt']) {
      if (!names.includes(need)) throw new Error(`missing index ${need}`);
    }
    return `${idx.length} indexes`;
  }, 'Start the server once (npm start) or re-run this phase; indexes are created on connect');
  const demo = await Measurement.countDocuments({ demo: true });
  const real = await Measurement.countDocuments({ demo: { $ne: true } });
  console.log(`  info: ${real} real measurements, ${demo} practice (demo) measurements`);
  await disconnectDb();
}

finish(1, 'Phase 2 (npm run verify:2)');
