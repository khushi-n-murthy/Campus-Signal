// PRACTICE DATA ONLY. Fills two weeks of made-up tests so the 3D views have something to show
// while you build. Every document gets demo: true, and the app labels it. Remove with purge-demo.js
// before collecting real data. Usage: node scripts/seed-demo.js --yes
import { config } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { Room, Measurement } from '../src/models.js';
import { computeScore } from '../src/score.js';
import { istParts } from '../src/time.js';

if (!process.argv.includes('--yes')) {
  console.log('This writes FAKE practice measurements (marked demo: true). Re-run with --yes to continue.');
  process.exit(0);
}

// Small seeded random generator so every run produces the same practice data.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(42);
const between = (lo, hi) => lo + rand() * (hi - lo);

// Base download speed (Mbps) per network per building, to make the practice map interesting.
const BASE = {
  ADMIN: { Jio: 24, Airtel: 14, Vi: 7, 'Campus WiFi': 22 },
  DTH: { Jio: 20, Airtel: 12, Vi: 6, 'Campus WiFi': 26 },
  MECH: { Jio: 12, Airtel: 18, Vi: 5, 'Campus WiFi': 10 },
  BIO: { Jio: 16, Airtel: 9, Vi: 4, 'Campus WiFi': 14 },
  GH: { Jio: 8, Airtel: 6, Vi: 3, 'Campus WiFi': 4 },
  IEM: { Jio: 10, Airtel: 8, Vi: 4, 'Campus WiFi': 18 },
  KRIYA: { Jio: 18, Airtel: 15, Vi: 6, 'Campus WiFi': 20 },
  RVU: { Jio: 14, Airtel: 20, Vi: 8, 'Campus WiFi': 16 },
  TAC: { Jio: 9, Airtel: 6, Vi: 4, 'Campus WiFi': 5 },
  BANK: { Jio: 22, Airtel: 18, Vi: 9, 'Campus WiFi': 12 },
  CIVIL: { Jio: 19, Airtel: 10, Vi: 6, 'Campus WiFi': 15 },
  EEE: { Jio: 13, Airtel: 17, Vi: 7, 'Campus WiFi': 19 },
  ECE: { Jio: 21, Airtel: 13, Vi: 5, 'Campus WiFi': 24 },
  PE: { Jio: 25, Airtel: 16, Vi: 10, 'Campus WiFi': 8 },
  CSE: { Jio: 23, Airtel: 15, Vi: 6, 'Campus WiFi': 30 },
  HC: { Jio: 15, Airtel: 12, Vi: 5, 'Campus WiFi': 11 },
  KH: { Jio: 11, Airtel: 14, Vi: 5, 'Campus WiFi': 9 },
  CBH: { Jio: 10, Airtel: 16, Vi: 4, 'Campus WiFi': 7 },
  MATH: { Jio: 17, Airtel: 11, Vi: 6, 'Campus WiFi': 18 },
  CHEM: { Jio: 9, Airtel: 19, Vi: 8, 'Campus WiFi': 12 },
  TELE: { Jio: 20, Airtel: 13, Vi: 7, 'Campus WiFi': 21 },
  MING: { Jio: 9, Airtel: 6, Vi: 4, 'Campus WiFi': 5 },
  LIB: { Jio: 15, Airtel: 12, Vi: 4, 'Campus WiFi': 28 },
  ISE: { Jio: 18, Airtel: 14, Vi: 6, 'Campus WiFi': 25 },
};

await connectDb(config.mongoUri, config.dbName);
const rooms = await Room.find().lean();
if (!rooms.length) {
  console.error('No rooms yet. Run: npm run seed:campus');
  process.exit(1);
}
await Measurement.deleteMany({ demo: true });

const devices = Array.from({ length: 40 }, (_, i) => `demo-device-${String(i).padStart(2, '0')}`);
const docs = [];
const now = Date.now();
for (const room of rooms) {
  const base = BASE[room.buildingId] || BASE.ADMIN;
  for (const [carrier, mbps] of Object.entries(base)) {
    const deadZone = carrier === 'Jio' && room.buildingId === 'CHEM' && room.floor === 2; // a deliberate dead zone
    const count = (deadZone ? 45 : 10) + Math.floor(rand() * 25); // enough tests there to meet the IT-report rule
    for (let i = 0; i < count; i++) {
      const at = new Date(now - between(0, 14) * 24 * 3600 * 1000);
      const { hour, dow } = istParts(at);
      if (hour < 8 || hour > 18) continue; // college hours only
      const crowded = hour >= 11 && hour <= 13 ? 0.35 : 1; // lunch-hour congestion
      const floorPenalty = deadZone ? 0.08 : 1;
      const downMbps = Math.max(0.2, mbps * crowded * floorPenalty * between(0.6, 1.3));
      const latencyMs = between(35, 90) / crowded / Math.sqrt(floorPenalty);
      const jitterMs = between(4, 25) / crowded;
      const lossPct = floorPenalty < 1 ? between(4, 15) : crowded < 1 ? between(0, 4) : between(0, 1);
      const value = {
        downMbps: +downMbps.toFixed(1),
        upMbps: +(downMbps * between(0.2, 0.5)).toFixed(1),
        latencyMs: Math.round(latencyMs),
        jitterMs: Math.round(jitterMs),
        lossPct: +lossPct.toFixed(1),
      };
      docs.push({
        roomId: room._id,
        buildingId: room.buildingId,
        floor: room.floor,
        carrier,
        asn: null,
        connType: carrier === 'Campus WiFi' ? 'wifi' : 'cellular',
        ...value,
        score: computeScore(value),
        device: devices[Math.floor(rand() * devices.length)],
        hour,
        dow,
        demo: true,
        createdAt: at,
      });
    }
  }
}
await Measurement.insertMany(docs);
console.log(`Inserted ${docs.length} PRACTICE measurements (demo: true) across ${rooms.length} rooms`);
await disconnectDb();
