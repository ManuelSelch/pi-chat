import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);

test('chimes is a browser-only plugin and Settings contains only a generic contribution outlet', async () => {
  const plugin = JSON.parse(await readFile(new URL('plugins/chimes/package.json', root), 'utf8'));
  assert.equal(plugin.name, '@manuelselch/pi-plugin-chimes');
  assert.equal(plugin.exports['./host'], undefined);
  assert.equal(plugin.dependencies['pi-chat'], undefined);
  assert.equal(plugin.dependencies['@manuelselch/pi-server'], undefined);
  for (const path of await readdir(new URL('plugins/chimes/src/', root), { recursive: true })) {
    if (!/\.(ts|tsx)$/.test(path)) continue;
    const content = await readFile(new URL(`plugins/chimes/src/${path}`, root), 'utf8');
    assert.doesNotMatch(content, /packages\/pi-chat|@manuelselch\/pi-server|web\/types\/view-types/);
  }
  const container = await readFile(new URL('packages/pi-chat/src/web/features/settings/components/SettingsContainer.tsx', root), 'utf8');
  const drawer = await readFile(new URL('packages/pi-chat/src/web/features/settings/components/SettingsDrawer.tsx', root), 'utf8');
  assert.match(container, /settings\.feature-toggles/);
  assert.doesNotMatch(container + drawer, /[Cc]hime/);
});
