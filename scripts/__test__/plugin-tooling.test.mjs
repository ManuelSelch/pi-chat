import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pluginWorkspaces, orderPlugins } from '../plugin-workspaces.mjs';
import { pluginArguments } from '../run-plugins.mjs';
import { verifyPluginArtifact } from '../verify-plugin-package.mjs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

const plugin = (name, dependencies = {}) => ({ directory: `plugins/${name}`, manifest: { name, dependencies } });

test('discovers new plugins without a hardcoded list and orders dependencies before consumers', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pi plugin discovery '));
  try {
    for (const entry of [plugin('a-consumer', { 'z-provider': '1.0.0' }), plugin('z-provider'), plugin('m-extra')]) {
      await mkdir(join(directory, entry.directory), { recursive: true });
      await writeFile(join(directory, entry.directory, 'package.json'), JSON.stringify(entry.manifest));
    }
    await mkdir(join(directory, 'plugins', 'not-a-workspace'));
    const discovered = await pluginWorkspaces(pathToFileURL(`${directory}/`));

    assert.deepEqual(discovered.map(entry => entry.manifest.name), ['z-provider', 'a-consumer', 'm-extra']);
    assert.deepEqual(pluginArguments('build', discovered), [
      'run', 'build', '--workspace', 'plugins/z-provider', '--workspace', 'plugins/a-consumer', '--workspace', 'plugins/m-extra',
    ]);
    assert.deepEqual(pluginArguments('test:coverage', discovered).slice(0, 2), ['run', 'test:coverage']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('rejects duplicate plugin identities and dependency cycles before execution', () => {
  assert.throws(() => orderPlugins([plugin('same'), plugin('same')]), /Duplicate plugin name/);
  assert.throws(() => orderPlugins([plugin('a', { b: '*' }), plugin('b', { a: '*' })]), /Plugin dependency cycle/);
  assert.throws(() => pluginArguments(undefined, []), /script name is required/);
});

test('watches every discovered plugin with fail-fast concurrent cleanup', () => {
  assert.deepEqual(pluginArguments('watch', [plugin('one'), plugin('two')]), [
    'exec', '--', 'concurrently', '-k',
    "npm exec --workspace='one' -- tsc -p tsconfig.json --watch",
    "npm exec --workspace='two' -- tsc -p tsconfig.json --watch",
  ]);
});

test('checks every conditional runtime and declaration export against the packed artifact', () => {
  const manifest = { exports: {
    '.': { browser: { types: './dist/web.d.ts', default: './dist/web.js' }, node: { types: './dist/host.d.ts', default: './dist/host.js' } },
  } };
  const files = ['dist/web.d.ts', 'dist/web.js', 'dist/host.d.ts', 'dist/host.js'].map(path => ({ path }));

  verifyPluginArtifact(manifest, { files });
  for (const missing of files)
    assert.throws(() => verifyPluginArtifact(manifest, { files: files.filter(file => file !== missing) }), /Missing plugin export/);
  for (const path of ['src/host.ts', 'dist/__tests__/host.js', 'dist/host.test.js'])
    assert.throws(() => verifyPluginArtifact(manifest, { files: [...files, { path }] }), { code: 'ERR_ASSERTION' });
  assert.throws(() => verifyPluginArtifact({ exports: { '.': './src/index.ts' } }, { files }), /must be compiled/);
});

test('shared cleanup only removes the invoking workspace dist, including paths with spaces and URL characters', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pi plugin # cleanup '));
  try {
    await mkdir(join(directory, 'dist'));
    await writeFile(join(directory, 'dist', 'stale.js'), 'stale');
    await writeFile(join(directory, 'keep.ts'), 'source');

    execFileSync(process.execPath, [fileURLToPath(new URL('scripts/clean-dist.mjs', root))], { cwd: directory });

    await assert.rejects(readFile(join(directory, 'dist', 'stale.js')), { code: 'ENOENT' });
    assert.equal(await readFile(join(directory, 'keep.ts'), 'utf8'), 'source');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('plugins share configuration while retaining their runtime-specific TypeScript requirements', async () => {
  const manifest = await json('package.json');
  assert.ok(manifest.workspaces.includes('plugins/*'));
  for (const script of Object.values(manifest.scripts)) assert.doesNotMatch(script, /pi-plugin-/);
  for (const name of ['file-opening', 'folder-opening']) {
    const config = await json(`plugins/${name}/tsconfig.json`);
    const plugin = await json(`plugins/${name}/package.json`);

    assert.equal(config.extends, '../../config/plugins/tsconfig.json');
    assert.deepEqual(config.compilerOptions.types, name === 'folder-opening' ? ['node', 'react'] : ['node']);
    assert.equal(plugin.scripts.build, 'node ../../scripts/clean-dist.mjs && tsc -p tsconfig.json');
    const lint = await readFile(new URL(`plugins/${name}/eslint.config.mjs`, root), 'utf8');
    assert.match(lint, /config\/plugins\/eslint\.config\.mjs/);
    const tests = await readFile(new URL(`plugins/${name}/vitest.config.ts`, root), 'utf8');
    assert.match(tests, /config\/plugins\/vitest\.js/);
  }
});
