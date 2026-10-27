// Tiny checker used by every phase script. Prints ✓ / ✗ / ! lines and a clear STOP or GO at the end.
import mongoose from 'mongoose';
import { config } from '../src/config.js';

const useColor = process.stdout.isTTY;
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
export const green = (s) => paint(32, s);
export const red = (s) => paint(31, s);
export const yellow = (s) => paint(33, s);
export const bold = (s) => paint(1, s);

let passed = 0;
let failed = 0;
let warned = 0;

export function title(phase, name, proves) {
  console.log(bold(`\n=== Phase ${phase}: ${name} ===`));
  if (proves) console.log(`What this proves: ${proves}\n`);
}

export function section(name) {
  console.log(bold(`\n-- ${name}`));
}

// check('name', () => condition or throw, 'how to fix if it fails')
export async function check(name, fn, fix) {
  try {
    const result = await fn();
    if (result === false) throw new Error('condition was false');
    passed += 1;
    console.log(`  ${green('✓')} ${name}${typeof result === 'string' ? `  (${result})` : ''}`);
    return true;
  } catch (err) {
    failed += 1;
    console.log(`  ${red('✗')} ${name}\n      ${red('why:')} ${err.message}`);
    if (fix) console.log(`      ${yellow('fix:')} ${fix}`);
    return false;
  }
}

export function warn(message) {
  warned += 1;
  console.log(`  ${yellow('!')} ${message}`);
}

export function expectEqual(actual, expected, label = 'value') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label} was ${a}, expected ${e}`);
  return true;
}

export function finish(phase, next) {
  console.log(`\n${passed} passed, ${failed} failed${warned ? `, ${warned} warnings` : ''}`);
  if (failed === 0) {
    console.log(green(bold(`PHASE ${phase} PASSED.`)) + (next ? ` Continue to ${next}.` : ''));
    process.exitCode = 0;
  } else {
    console.log(red(bold(`STOP. Phase ${phase} has ${failed} problem(s). Fix the ✗ lines above, then run this phase again.`)));
    process.exitCode = 1;
  }
}

// Starts the real app on a random port against a separate "<DB_NAME>_verify" database,
// so verification never touches your real data.
export async function startTestServer(overrides = {}, lookup = null) {
  const cfg = { ...config, dbName: `${config.dbName}_verify`, ...overrides };
  // Loaded here, not at the top, so the early phases can run before these files exist.
  const { connectDb } = await import('../src/db.js');
  const { createApp } = await import('../src/app.js');
  if (mongoose.connection.readyState !== 1) await connectDb(cfg.mongoUri, cfg.dbName);
  const { httpServer, io } = createApp({ config: cfg, lookup });
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${httpServer.address().port}`;
  return {
    base,
    cfg,
    async close({ dropDb = true } = {}) {
      io.close();
      await new Promise((resolve) => httpServer.close(resolve));
      if (dropDb) await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    },
  };
}

export async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`expected JSON, got: ${text.slice(0, 120)}`);
  }
}
