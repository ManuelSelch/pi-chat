import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run verify:protocol.');
for (const script of ['protocol:generate', 'probe:swift:generate'])
  execFileSync(process.execPath, [npm, 'run', script, '-w', '@manuelselch/pi-sdk'], { cwd: root, stdio: 'inherit' });
const path = 'packages/pi-sdk-typescript/protocol';
execFileSync('git', ['diff', '--exit-code', 'HEAD', '--', path], { cwd: root, stdio: 'inherit' });
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', path], { cwd: root, encoding: 'utf8' });
if (untracked.trim()) throw new Error(`Uncommitted generated protocol artifacts:\n${untracked}`);
