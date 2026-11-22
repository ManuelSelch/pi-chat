import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { verifyPluginPackage } from '../../../scripts/verify-plugin-package.mjs';

const artifact = await verifyPluginPackage();
for (const path of ["dist/contract.js","dist/contract.d.ts","dist/host/file-service.js","dist/host/system-file-opener.js"])
  assert.ok(artifact.files.some(file => file.path === path), path);
const contract = await import('@manuelselch/pi-plugin-file-opening');
const host = await import('@manuelselch/pi-plugin-file-opening/host');
assert.equal(contract.fileOpeningContract, host.fileOpeningContract);
assert.equal(host.createFileOpeningPlugin({ open: async () => ({ ok: true }) }).id, contract.fileOpeningContract.id);
const web = await import('@manuelselch/pi-plugin-file-opening/web');
assert.equal(typeof web.createFileOpeningPlugin, 'function');
assert.equal('FileService' in web, false);
assert.equal('createFileOpeningPlugin' in contract, false);
execFileSync(process.execPath, ['--conditions=browser', '--input-type=module', '-e', `
  import assert from 'node:assert/strict';
  import { fileOpeningContract } from '@manuelselch/pi-plugin-file-opening';
  import { createFileOpeningPlugin } from '@manuelselch/pi-plugin-file-opening/web';
  assert.equal(fileOpeningContract.id, 'file-opening');
  assert.equal(typeof createFileOpeningPlugin, 'function');
`], { stdio: 'pipe' });
console.log('Verified compiled contract/web/host entries and test-free contents; isolated host consumer is covered by Server artifact verification.');
