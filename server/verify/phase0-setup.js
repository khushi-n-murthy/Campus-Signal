// Phase 0: tools installed, files in place, .env filled in.
import fs from 'node:fs';
import { title, section, check, warn, finish } from './lib.js';
import { config, configProblems } from '../src/config.js';

title(0, 'Setup', 'Node, the packages and your .env are ready, so later failures are about code, not setup.');

section('Tools');
await check(
  'Node.js is version 22 or newer',
  () => {
    const major = Number(process.versions.node.split('.')[0]);
    if (major < 22) throw new Error(`you have Node ${process.versions.node}`);
    return `v${process.versions.node}`;
  },
  'Install Node 22 LTS from nodejs.org, close and reopen the terminal, then run node -v',
);

section('Files');
await check('server/.env exists', () => fs.existsSync('.env'), 'Copy .env.example to .env (cp .env.example .env) and fill it in');
await check('server/data/campus.json exists', () => fs.existsSync('data/campus.json'), 'Restore data/campus.json from the guide');
await check('package.json is an ES module project', () => JSON.parse(fs.readFileSync('package.json', 'utf8')).type === 'module', 'Run: npm pkg set type=module');

section('Packages');
for (const pkg of ['express', 'mongoose', 'socket.io', 'maxmind', 'geolite2-redist', 'qrcode', 'dotenv', 'socket.io-client', 'jsqr', 'pngjs']) {
  await check(`${pkg} is installed`, async () => {
    await import(pkg);
    return true;
  }, 'Run npm install inside the server folder');
}

section('.env values');
await check('No configuration errors', () => {
  const problems = configProblems();
  if (problems.length) throw new Error(problems.join('; '));
  return true;
}, 'Edit server/.env as the message says');
await check('MONGODB_URI looks like a MongoDB address', () => /^mongodb(\+srv)?:\/\//.test(config.mongoUri), 'It must start with mongodb:// or mongodb+srv://');
await check('PUBLIC_URL starts with http:// or https://', () => /^https?:\/\//.test(config.publicUrl), 'Example: PUBLIC_URL=http://localhost:4000');
if (config.deviceSalt === 'dev-only-salt-change-me' || config.deviceSalt.startsWith('change-me')) {
  warn('DEVICE_SALT is still a placeholder. Fine for now; set a long random value before real users (Phase 9).');
}
if (!config.campusCidrs.length) warn('CAMPUS_CIDRS is empty. Campus WiFi will show as "Other" until you fill it in (Phase 2).');

finish(0, 'Phase 1 (npm run verify:1)');
