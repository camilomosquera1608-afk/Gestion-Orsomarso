import { spawnSync } from 'node:child_process';

const run = spawnSync(
  'npx',
  ['jest', 'lib/__tests__/load-risk-engine.test.ts', '--runInBand'],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);
process.exit(run.status ?? 1);
