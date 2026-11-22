import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('folder opening is an independent vertical plugin with runtime-specific public entries', async () => {
  const plugin = await json('plugins/folder-opening/package.json');
  assert.equal(plugin.name, '@manuelselch/pi-plugin-folder-opening');
  assert.deepEqual(Object.keys(plugin.exports), ['.', './web', './host']);
  assert.equal(plugin.dependencies['@manuelselch/pi-server'], undefined);
  assert.equal(plugin.dependencies['pi-chat'], undefined);
  for (const file of await readdir(new URL('plugins/folder-opening/src/', root), { recursive: true })) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const source = await readFile(new URL(`plugins/folder-opening/src/${file}`, root), 'utf8');
    assert.doesNotMatch(source, /packages\/pi-chat|packages\/pi-server|web\/app|web\/hooks|web\/components/);
  }
  const sdk = await json('packages/pi-sdk-typescript/package.json');
  assert.equal(sdk.exports['./plugins/folder-opening'], undefined);
});
