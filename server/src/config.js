// Reads settings from .env once, checks them, and exports plain values.
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

function list(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || '',
  dbName: process.env.DB_NAME || 'campussignal',
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:4000').replace(/\/+$/, ''),
  // Public IP ranges your campus WiFi uses to reach the internet, e.g. "203.0.113.10/32".
  campusCidrs: list(process.env.CAMPUS_CIDRS),
  // Secret mixed into device ids before hashing, so stored ids cannot be traced back.
  deviceSalt: process.env.DEVICE_SALT || 'dev-only-salt-change-me',
  // How Express finds the real client IP behind a proxy. 'loopback' for local runs; see guide for hosting.
  trustProxy: process.env.TRUST_PROXY || 'loopback',
  // Measurements older than this many days are ignored by every summary.
  windowDays: Number(process.env.WINDOW_DAYS) || 28,
  // Show seeded demo measurements in summaries (turn off once real data exists).
  includeDemo: bool(process.env.INCLUDE_DEMO, !isProduction),
  // Minimum seconds between two tests from the same device in the same room.
  rateLimitSeconds: Number(process.env.RATE_LIMIT_SECONDS ?? 120),
};

export function configProblems(cfg = config) {
  const problems = [];
  if (!cfg.mongoUri) problems.push('MONGODB_URI is empty. Put your MongoDB connection string in server/.env');
  if (cfg.isProduction && cfg.deviceSalt === 'dev-only-salt-change-me') {
    problems.push('DEVICE_SALT is still the default. Set a long random value in production.');
  }
  for (const c of cfg.campusCidrs) {
    if (!/^[0-9a-fA-F:.]+\/\d{1,3}$/.test(c)) problems.push(`CAMPUS_CIDRS entry "${c}" is not in a.b.c.d/nn form`);
  }
  return problems;
}
