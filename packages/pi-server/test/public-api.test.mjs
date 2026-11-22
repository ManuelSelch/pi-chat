import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Set isolation before importing Pi or any server modules.
const directory = await mkdtemp(join(tmpdir(), 'pi-server-api-'));
process.env.PI_CODING_AGENT_DIR = join(directory, 'agent');
const api = await import('../dist/index.js');
const plugins = await import('../dist/plugins.js');
const { definePlugin } = await import('@manuelselch/pi-sdk/plugins');
const testing = await import('../dist/testing/index.js');
const { ServerDriver } = await import('./server-driver.mjs');

try {
  await test('public exports expose contracts, not application/transport internals', () => {
    for (const name of ['createPiServer', 'createPiRuntimeAdapter', 'createRestartService', 'createFileLogger']) assert.equal(typeof api[name], 'function');
    for (const name of ['ChatApplicationService', 'WebSocketTransport', 'PiRuntimeAdapter', 'ProjectSessionService']) assert.equal(api[name], undefined);
    assert.equal(typeof plugins.createPluginRuntime, 'function');
    assert.equal(testing.resetPiChatExtensionRegistryForTests, undefined);
    assert.equal(typeof testing.snapshotData, 'function');
  });
  await test('headless public host initializes the SDK without creating a runtime', async () => {
    await ServerDriver.run(directory, async server => {
      await server.assertHealthy();
      await server.assertHeadless();
      await server.connect();
      server.assertNoRuntimesCreated();
      await server.createAndCloseRuntime();
    });
  });
  await test('explicit embedding assets support SPA fallback', async () => {
    const assets = join(directory, 'web');
    await mkdir(assets); await writeFile(join(assets, 'index.html'), 'embedded assets');
    await ServerDriver.run(directory, server => server.assertStatic('embedded assets'), { staticDirectory: assets });
  });
  await test('close before listen disposes injected runtime once without owning its logger', async () => {
    let disposed = 0; let loggerClosed = 0; let activated = 0; let pluginDisposed = 0;
    let signal;
    const plugin = definePlugin({ id: 'installed', host: async () => ({ setup(ctx) {
      activated++; signal = ctx.signal; ctx.onCleanup(() => { pluginDisposed++; });
    } }) });
    const runtime = new testing.FakeRuntimeAdapter();
    runtime.dispose = () => { disposed++; };
    const logger = { info() {}, warn() {}, error() {}, flush: async () => {}, close: async () => { loggerClosed++; } };
    const server = await api.createPiServer({ runtime, logger, plugins: [plugin], catalogue: { metadataFile: join(directory, 'close.json') } });
    assert.equal(activated, 1); assert.equal(signal.aborted, false);
    await server.close(); await server.close();
    assert.equal(disposed, 1); assert.equal(loggerClosed, 0);
    assert.equal(pluginDisposed, 1); assert.equal(signal.aborted, true);
  });
  await test('standalone restart never invokes npm or an implicit build', async () => {
    const order = [];
    const service = api.createRestartService({ plan: { command: process.execPath, args: ['installed.js'], cwd: directory }, pid: 123,
      spawnDetached: () => order.push('spawn'), shutdown: () => order.push('shutdown') });
    assert.equal(await service.restart(), undefined);
    assert.deepEqual(order, ['spawn', 'shutdown']);
  });
  await test('explicit failed build leaves the current process serving', async () => {
    const service = api.createRestartService({ build: async () => 'broken build',
      shutdown: () => assert.fail('must not shut down'), spawnDetached: () => assert.fail('must not spawn') });
    assert.equal(await service.restart(), 'broken build');
  });
} finally { await rm(directory, { recursive: true, force: true }); }
