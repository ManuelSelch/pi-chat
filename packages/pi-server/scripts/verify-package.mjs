import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.env.npm_execpath;
assert.ok(npm, 'Run through npm run verify:package to select the trusted npm CLI');
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const sourceSdk = fileURLToPath(new URL('../../pi-sdk-typescript/', import.meta.url));
const sourceManifest = JSON.parse(await readFile(join(sourceSdk, 'package.json'), 'utf8'));
assert.equal(sourceManifest.version, manifest.dependencies['@manuelselch/pi-sdk']);
const compiler = join(dirname(createRequire(import.meta.url).resolve('typescript/package.json')), 'bin/tsc');
assert.ok(!(manifest.bundleDependencies ?? []).includes('@manuelselch/pi-sdk'));
assert.ok(!(manifest.bundledDependencies ?? []).includes('@manuelselch/pi-sdk'));
const directory = await mkdtemp(join(tmpdir(), 'pi server packed '));
const run = (args, cwd, options = {}) => execFileSync(process.execPath, args, {
  cwd, stdio: 'inherit', timeout: 120000, env: { ...process.env, NODE_PATH: '', PI_CODING_AGENT_DIR: join(directory, 'agent') }, ...options,
});
try {
  const result = JSON.parse(run([npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', directory], root, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }))[0];
  assert.ok(!result.bundled.includes('@manuelselch/pi-sdk'), 'SDK must install as an explicit dependency, not be bundled');
  for (const file of result.files) {
    assert.ok(!file.path.startsWith('src/'), 'Source leaked into compiled artifact');
    assert.ok(!file.path.includes('vendor/'), 'Vendor archive leaked into compiled artifact');
    assert.ok(!file.path.includes('node_modules/@manuelselch/pi-sdk/'), 'Bundled SDK files leaked into compiled artifact');
  }
  const sdk = JSON.parse(run([npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', directory], sourceSdk, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }))[0];
  const pluginRoot = fileURLToPath(new URL('../../../plugins/folder-opening/', import.meta.url));
  const plugin = JSON.parse(run([npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', directory], pluginRoot, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }))[0];
  const sdkFilename = sdk.filename;
  await writeFile(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: {
    '@manuelselch/pi-server': './' + result.filename,
    '@manuelselch/pi-sdk': './' + sdkFilename,
    '@manuelselch/pi-plugin-folder-opening': './' + plugin.filename,
  } }));
  run([npm, 'install', '--ignore-scripts', '--no-audit', '--no-fund'], directory);
  const installedServer = JSON.parse(await readFile(join(directory, 'node_modules/@manuelselch/pi-server/package.json'), 'utf8'));
  assert.equal(installedServer.dependencies['@manuelselch/pi-sdk'], manifest.dependencies['@manuelselch/pi-sdk']);
  const require = createRequire(join(directory, 'consumer.mjs'));
  const sdkRoot = join(directory, 'node_modules/@manuelselch/pi-sdk');
  // Resolve ESM import conditions: the SDK deliberately has no CommonJS entry.
  run(['--experimental-import-meta-resolve', '--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    const server = import.meta.resolve('@manuelselch/pi-server');
    assert.equal(import.meta.resolve('@manuelselch/pi-sdk', server), import.meta.resolve('@manuelselch/pi-sdk'));
  `], directory);
  const consumerLock = JSON.parse(await readFile(join(directory, 'package-lock.json'), 'utf8'));
  assert.equal(consumerLock.packages['node_modules/@manuelselch/pi-sdk'].resolved, 'file:' + sdkFilename);
  assert.equal(consumerLock.packages['node_modules/@manuelselch/pi-sdk'].integrity, sdk.integrity);
  const installedSdk = JSON.parse(await readFile(join(sdkRoot, 'package.json'), 'utf8'));
  assert.equal(installedSdk.version, sourceManifest.version);
  assert.deepEqual(installedSdk.exports, sourceManifest.exports);
  for (const file of ['dist/extension-ui.js', 'dist/protocol/models.js', 'dist/protocol/v2.js', 'dist/protocol/prompt-presentation.js', 'dist/plugins/index.js', 'dist/plugins/plugin.js', 'dist/plugins/remote-contract.js', 'dist/plugins/file-opening.js']) {
    assert.deepEqual(await readFile(join(sdkRoot, file)), await readFile(join(sourceSdk, file)), file);
  }
  run([npm, 'ls', '@manuelselch/pi-sdk', '--all'], directory);
  // Test helpers and server share the same explicitly packed workspace SDK.
  const sdkEntry = JSON.stringify(pathToFileURL(join(sdkRoot, 'dist/index.js')).href);
  for (const name of ['react', '@mantine/core', 'vite', 'tsx']) assert.throws(() => require.resolve(name), name + ' unexpectedly installed');
  // The Node-selected declaration activates its synchronous host entry without browser peers installed.
  run(['--input-type=module', '--eval', `
    import { createPiServer } from '@manuelselch/pi-server';
    import { FakeRuntimeAdapter } from '@manuelselch/pi-server/testing';
    import { folderOpeningPlugin, folderOpeningContract } from '@manuelselch/pi-plugin-folder-opening';
    const server = await createPiServer({
      runtime: new FakeRuntimeAdapter(), catalogue: { homeDirectory: null },
      plugins: [folderOpeningPlugin], pluginRpcContracts: [folderOpeningContract],
    });
    await server.close();
  `], directory);
  // These are the same behavioral scenarios, now using only documented installed exports/bin.
  for (const file of await readdir(join(root, 'test'))) {
    if (!file.endsWith('.mjs')) continue;
    let source = await readFile(join(root, 'test', file), 'utf8');
    source = source.replaceAll("'@manuelselch/pi-sdk'", sdkEntry)
      .replaceAll("'../dist/index.js'", "'@manuelselch/pi-server'")
      .replaceAll("'../dist/extensions.js'", "'@manuelselch/pi-server/extensions'")
      .replaceAll("'../dist/plugins.js'", "'@manuelselch/pi-server/plugins'")
      .replaceAll("'../dist/testing/index.js'", "'@manuelselch/pi-server/testing'")
      .replaceAll("new URL('../dist/cli.js', import.meta.url)", "new URL('./node_modules/.bin/pi-server', import.meta.url)")
      .replaceAll("new URL('../dist/testing/loopback.js', import.meta.url).href", "'@manuelselch/pi-server/testing/loopback'");
    await writeFile(join(directory, file), source);
  }
  run(['--test', ...((await readdir(directory)).filter(file => file.endsWith('.test.mjs')))], directory);
  await writeFile(join(directory, 'consumer.ts'), `import { createPiServer, createPiRuntimeAdapter, createRestartService, type PiServerOptions, type RuntimeAdapter, type FileLogger } from '@manuelselch/pi-server';
import { getPiChatExtensionRegistry, type PiChatExtensionRegistry } from '@manuelselch/pi-server/extensions';
import { createFileOpeningPlugin } from '@manuelselch/pi-server/plugins';
import { folderOpeningPlugin } from '@manuelselch/pi-plugin-folder-opening';
import { folderOpeningContract } from '@manuelselch/pi-plugin-folder-opening';
import { fileOpeningContract } from '@manuelselch/pi-sdk/plugins/file-opening';
import { FakeRuntimeAdapter, snapshotData } from '@manuelselch/pi-server/testing';
import { runLoopbackFixture } from '@manuelselch/pi-server/testing/loopback';
const options: PiServerOptions = { runtime: new FakeRuntimeAdapter(), extensions: getPiChatExtensionRegistry(), catalogue: { homeDirectory: null }, plugins: services => [createFileOpeningPlugin({ open: services.openFile }), folderOpeningPlugin], pluginRpcContracts: [fileOpeningContract, folderOpeningContract] };
const server = await createPiServer(options); void server.httpServer; void server.close;
void createPiRuntimeAdapter; void createRestartService; void snapshotData; void runLoopbackFixture;
`);
  run([compiler, '--noEmit', '--strict', '--skipLibCheck', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2023', 'consumer.ts'], directory);
  assert.throws(() => require.resolve('@manuelselch/pi-server/dist/transport/websocket-transport.js'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
  console.log('Verified compiled packed server exports, explicit packed workspace SDK dependency, SDK initialization, CLI/restart/signals and loopback safety in an isolated consumer.');
} finally { await rm(directory, { recursive: true, force: true }); }
