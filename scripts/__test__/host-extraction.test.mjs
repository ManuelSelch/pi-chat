import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
test('Server owns generic session lookup but no optional feature implementation or dependency', async () => {
  for (const file of await readdir(new URL('packages/pi-server/src/', root), { recursive: true })) {
    if (!file.endsWith('.ts')) continue;
    const source = await readFile(new URL(`packages/pi-server/src/${file}`, root), 'utf8');
    assert.doesNotMatch(source, /pi-plugin-(file|folder)-opening|DirectoryBrowserService|FileService|openFile|browseDirectories/, file);
  }
  const manifest = JSON.parse(await readFile(new URL('packages/pi-server/package.json', root), 'utf8'));
  for (const name of ['file-opening', 'folder-opening'])
    assert.equal(manifest.dependencies[`@manuelselch/pi-plugin-${name}`], undefined);
});
