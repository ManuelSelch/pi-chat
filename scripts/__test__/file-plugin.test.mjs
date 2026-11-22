import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('file opening owns its contract, browser actions and filesystem implementation independently', async () => {
  const plugin = await json('plugins/file-opening/package.json');
  assert.equal(plugin.name, '@manuelselch/pi-plugin-file-opening');
  assert.deepEqual(Object.keys(plugin.exports), ['.', './web', './host']);
  assert.equal(plugin.exports['.'].import, './dist/contract.js');
  assert.equal(plugin.dependencies['@manuelselch/pi-server'], undefined);
  assert.equal(plugin.dependencies['pi-chat'], undefined);

  for (const file of await readdir(new URL('plugins/file-opening/src/', root), { recursive: true })) {
    if (!file.endsWith('.ts')) continue;
    const source = await readFile(new URL(`plugins/file-opening/src/${file}`, root), 'utf8');
    assert.doesNotMatch(source, /@manuelselch\/pi-server|packages\/pi-chat|packages\/pi-server/);
  }

  const sdk = await json('packages/pi-sdk-typescript/package.json');
  assert.equal(sdk.exports['./plugins/file-opening'], undefined);
  const serverPlugins = await readFile(new URL('packages/pi-server/src/plugins.ts', root), 'utf8');
  assert.doesNotMatch(serverPlugins, /file-opening|FileOpening/);
});
