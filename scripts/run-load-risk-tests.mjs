import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

rmSync('.tmp/load-risk-tests', { recursive: true, force: true });
const compile = spawnSync('npx', ['tsc', '-p', 'tsconfig.load-risk-test.json'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (compile.status !== 0) process.exit(compile.status ?? 1);
const run = spawnSync('node', ['.tmp/load-risk-tests/scripts/load-risk-engine.test.js'], { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(run.status ?? 1);
