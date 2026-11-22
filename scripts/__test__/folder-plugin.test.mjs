import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('folder opening is an independent vertical plugin with runtime-specific public entries', async () => {
  const plugin = await json('plugins/folder-opening/package.json');
  assert.equal(plugin.name, '@manuelselch/pi-plugin-folder-opening');
  assert.deepEqual(Object.keys(plugin.exports), ['.', './web', './host']);
  assert.deepEqual(plugin.exports['.'], {
    browser: { types: './dist/browser.d.ts', default: './dist/browser.js' },
    node: { types: './dist/index.d.ts', default: './dist/index.js' },
  });
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

test('Chat registers folder UI once and renders only generic contributions', async () => {
  for (const file of await readdir(new URL('packages/pi-chat/src/web/', root), { recursive: true })) {
    if (!/\.(ts|tsx)$/.test(file) || file.includes('__test__')) continue;
    const source = await readFile(new URL(`packages/pi-chat/src/web/${file}`, root), 'utf8');
    if (file !== 'app/plugins/RegisteredPlugins.tsx')
      assert.doesNotMatch(source, /pi-plugin-folder-opening|FolderPickerContainer|folderPicker|browseDirectories/, file);
  }
  const provider = await readFile(new URL('plugins/folder-opening/src/web/stores/FolderOpeningProvider.tsx', root), 'utf8');
  const entry = await readFile(new URL('plugins/folder-opening/src/web/index.ts', root), 'utf8');
  assert.match(provider, /useState\(false\)/);
  assert.match(entry, /folder-opening\.open/);
});
