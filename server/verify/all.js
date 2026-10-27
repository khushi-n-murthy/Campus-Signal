// Runs phases 0-8 in order and stops at the first one that fails. (Phase 9 needs a deployed URL.)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(here).filter((f) => /^phase[0-8]-.*\.js$/.test(f)).sort();
for (const file of files) {
  const r = spawnSync(process.execPath, [path.join(here, file)], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.log(`\nStopped at ${file}. Fix it, then run: npm run verify`);
    process.exit(1);
  }
}
console.log('\nALL LOCAL PHASES PASSED (0-8). After deploying, run: npm run verify:9 -- https://your-site');
