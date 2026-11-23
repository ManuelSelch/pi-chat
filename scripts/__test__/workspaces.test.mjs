import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';

const root = new URL('../../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('links SDK and Server workspaces through public compiled package entries', async () => {
  const manifest = await json('package.json');
  const lock = await json('package-lock.json');
  assert.equal(manifest.private, true);
  assert.deepEqual(manifest.workspaces, ['packages/pi-sdk-typescript', 'plugins/*', 'packages/pi-server', 'packages/pi-chat']);
  assert.equal(manifest.pi, undefined);
  // Application sources must be package-owned; isolated mockups may live at root.
  const oldRoots = ['src', 'extension', 'testing', 'public', 'themes', 'plans', 'index.html'];
  assert.equal(execFileSync('git', ['ls-files', '--', ...oldRoots], { cwd: root, encoding: 'utf8' }), '');
  const chat = await json('packages/pi-chat/package.json');
  assert.equal(chat.name, 'pi-chat');
  assert.deepEqual(chat.pi.extensions, ['./extension/pi-chat.ts']);
  assert.deepEqual(lock.packages['node_modules/pi-chat'], { resolved: 'packages/pi-chat', link: true });
  for (const [name, directory] of [
    ['@manuelselch/pi-sdk', 'packages/pi-sdk-typescript'],
    ['@manuelselch/pi-server', 'packages/pi-server'],
    ['@manuelselch/pi-plugin-file-opening', 'plugins/file-opening'],
    ['@manuelselch/pi-plugin-folder-opening', 'plugins/folder-opening'],
  ]) {
    const workspace = await json(`${directory}/package.json`);
    assert.equal(chat.dependencies[name], workspace.version);
    assert.deepEqual(lock.packages[`node_modules/${name}`], { resolved: directory, link: true });
    assert.equal(await realpath(new URL(`node_modules/${name}`, root)), await realpath(new URL(directory, root)));
    const entry = workspace.exports['.'];
    if (name === '@manuelselch/pi-plugin-file-opening')
      assert.equal(entry.import, './dist/contract.js');
    else if (name === '@manuelselch/pi-plugin-folder-opening')
      assert.equal(entry.node.default, './dist/host/index.js');
    else
      assert.equal(entry.import, './dist/index.js');
    assert.equal(lock.packages[`${directory}/node_modules/@manuelselch/pi-sdk`], undefined);
  }
  const server = await json('packages/pi-server/package.json');
  const sdk = await json('packages/pi-sdk-typescript/package.json');
  assert.equal(server.dependencies['@manuelselch/pi-sdk'], sdk.version);
});
