import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { verifyPluginPackage } from '../../../scripts/verify-plugin-package.mjs';

const artifact = await verifyPluginPackage();
for (const path of ["dist/contract.js","dist/contract.d.ts"])
  assert.ok(artifact.files.some(file => file.path === path), path);
for (const file of artifact.files)
  assert.doesNotMatch(file.path, /^dist\/(index|browser)\./);
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
