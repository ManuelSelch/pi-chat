import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const npm = process.env.npm_execpath;
assert.ok(npm, 'Run through npm run verify:package');
const [artifact] = JSON.parse(execFileSync(process.execPath, [npm, 'pack', '--dry-run', '--ignore-scripts', '--json'], { encoding: 'utf8' }));
for (const path of ['dist/index.js', 'dist/index.d.ts', 'dist/web/index.js', 'dist/web/index.d.ts', 'dist/host/index.js', 'dist/host/index.d.ts'])
  assert.ok(artifact.files.some(file => file.path === path), path);
for (const file of artifact.files)
  assert.doesNotMatch(file.path, /(^src\/|__tests__|\.test\.)/);
const { createFolderOpeningPlugin } = await import('../dist/host/index.js');
const { folderOpeningContract } = await import('../dist/index.js');
assert.equal(createFolderOpeningPlugin().id, folderOpeningContract.id);
console.log('Verified compiled plugin entries and test-free package contents; isolated host consumer is covered by Server artifact verification.');
