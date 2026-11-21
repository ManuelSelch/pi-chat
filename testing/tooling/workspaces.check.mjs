import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('links SDK and Server workspaces through public compiled package entries', async () => {
  const manifest = await json('package.json');
  const lock = await json('package-lock.json');
  assert.deepEqual(manifest.workspaces, ['packages/pi-sdk-typescript', 'packages/pi-server']);
  for (const [name, directory] of [
    ['@manuelselch/pi-sdk', 'packages/pi-sdk-typescript'],
    ['@manuelselch/pi-server', 'packages/pi-server'],
  ]) {
    const workspace = await json(`${directory}/package.json`);
    assert.equal(manifest.dependencies[name], workspace.version);
    assert.deepEqual(lock.packages[`node_modules/${name}`], { resolved: directory, link: true });
    assert.equal(await realpath(new URL(`node_modules/${name}`, root)), await realpath(new URL(directory, root)));
    assert.equal(workspace.exports['.'].import, './dist/index.js');
    assert.equal(lock.packages[`${directory}/node_modules/@manuelselch/pi-sdk`], undefined);
  }
  const server = await json('packages/pi-server/package.json');
  const sdk = await json('packages/pi-sdk-typescript/package.json');
  assert.equal(server.dependencies['@manuelselch/pi-sdk'], sdk.version);
});
