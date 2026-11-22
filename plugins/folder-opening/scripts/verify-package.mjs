import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const npm = process.env.npm_execpath;
assert.ok(npm, 'Run through npm run verify:package');
const [artifact] = JSON.parse(execFileSync(process.execPath, [npm, 'pack', '--dry-run', '--ignore-scripts', '--json'], { encoding: 'utf8' }));
for (const path of ['dist/contract.js', 'dist/contract.d.ts', 'dist/web/index.js', 'dist/web/index.d.ts', 'dist/host/index.js', 'dist/host/index.d.ts'])
  assert.ok(artifact.files.some(file => file.path === path), path);
for (const file of artifact.files)
  assert.doesNotMatch(file.path, /(^src\/|__tests__|\.test\.|^dist\/(index|browser)\.)/);
const { folderOpeningContract, folderOpeningPlugin } = await import('@manuelselch/pi-plugin-folder-opening');
assert.equal(folderOpeningPlugin.id, folderOpeningContract.id);
const hostEntry = await import('@manuelselch/pi-plugin-folder-opening/host');
assert.equal(folderOpeningPlugin, hostEntry.folderOpeningPlugin);
assert.equal(folderOpeningContract, hostEntry.folderOpeningContract);
assert.equal(typeof folderOpeningPlugin.host().setup, 'function');
assert.equal('web' in folderOpeningPlugin, false);
execFileSync(process.execPath, ['--conditions=browser', '--input-type=module', '-e', `
  import assert from 'node:assert/strict';
  import { folderOpeningContract, folderOpeningPlugin } from '@manuelselch/pi-plugin-folder-opening';
  import { folderOpeningUI, folderOpeningPlugin as webPlugin, folderOpeningContract as webContract } from '@manuelselch/pi-plugin-folder-opening/web';
  assert.equal(folderOpeningPlugin, webPlugin);
  assert.equal(folderOpeningContract, webContract);
  assert.equal(folderOpeningPlugin.id, folderOpeningContract.id);
  assert.equal('host' in folderOpeningPlugin, false);
  assert.equal(folderOpeningPlugin.web(), folderOpeningUI);
`], { stdio: 'pipe' });
console.log('Verified compiled plugin entries and test-free package contents; isolated host consumer is covered by Server artifact verification.');
