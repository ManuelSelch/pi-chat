import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const compiler = join(dirname(require.resolve('@typescript/native/package.json')), 'bin/tsc');
const harness = resolve(dirname(fileURLToPath(import.meta.resolve('@marcfargas/pi-test-harness'))), '..');
const sources = (await readdir(join(harness, 'src'))).filter(name => name.endsWith('.ts')).map(name => join(harness, 'src', name));
execFileSync(process.execPath, [compiler, '--ignoreConfig', '--noCheck', '--module', 'nodenext', '--target', 'es2022', '--declaration', '--outDir', join(harness, 'dist'), ...sources], { stdio: 'inherit' });
