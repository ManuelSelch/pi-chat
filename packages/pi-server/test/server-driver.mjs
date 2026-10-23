import assert from 'node:assert/strict';
import { once } from 'node:events';
import { join } from 'node:path';
import { PiClient, createWebSocketTransport } from '@manuelselch/pi-sdk';
import { createPiServer } from '../dist/index.js';
import { FakeRuntimeAdapter } from '../dist/testing/index.js';

export class ServerDriver {
  static async run(directory, scenario, options = {}) {
    const driver = new ServerDriver(directory, options);
    try { await driver.start(); await scenario(driver); }
    finally { await driver.close(); }
  }
  constructor(directory, options) {
    this.directory = directory;
    this.created = 0;
    this.options = options;
  }
  async start() {
    const factory = { continueProject: async () => assert.fail('unexpected continue'),
      openSession: async () => assert.fail('unexpected open'),
      newSession: async () => { this.created++; return new FakeRuntimeAdapter('public-runtime'); } };
    this.server = createPiServer({ runtimeFactory: factory, catalogue: {
      lister: { listAll: async () => [] }, sessionsDirectory: join(this.directory, 'sessions'),
      discovery: { forDirectory: async () => undefined }, metadataFile: join(this.directory, 'metadata.json'),
      homeDirectory: null,
    }, ...this.options });
    assert.equal(this.server.transport, undefined);
    this.server.httpServer.listen(0, '127.0.0.1');
    await once(this.server.httpServer, 'listening');
    this.url = 'http://127.0.0.1:' + this.server.httpServer.address().port;
  }
  async assertHealthy() { assert.deepEqual(await (await fetch(this.url + '/health')).json(), { ok: true }); }
  async assertHeadless() { assert.equal((await fetch(this.url + '/')).status, 404); }
  async assertStatic(text) {
    assert.equal(await (await fetch(this.url + '/')).text(), text);
    assert.equal(await (await fetch(this.url + '/nested/route')).text(), text);
  }
  async connect() {
    this.client = new PiClient({ endpoint: this.url.replace('http:', 'ws:') + '/ws',
      transport: createWebSocketTransport(endpoint => new WebSocket(endpoint)) });
    const ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { unsubscribe(); reject(new Error('SDK readiness timeout')); }, 5000);
      const unsubscribe = this.client.subscribe(state => {
        if (state.connection.phase === 'ready') { clearTimeout(timer); unsubscribe(); resolve(); }
        if (state.connection.phase === 'failed') { clearTimeout(timer); unsubscribe(); reject(new Error(JSON.stringify(state.connection))); }
      });
    });
    this.client.start();
    await ready;
  }
  assertNoRuntimesCreated() {
    assert.equal(this.created, 0);
    assert.deepEqual(this.client.getState().inventory, []);
  }
  async createAndCloseRuntime() {
    const id = await this.client.createSession(this.directory);
    assert.equal(this.created, 1);
    assert.ok(this.client.getSession(id));
    await this.client.closeSession(id);
    assert.equal(this.client.getSession(id), undefined);
  }
  async assertExtensionBadge(id) {
    const runtime = await this.client.createSession(this.directory);
    assert.ok(this.client.getSession(runtime).extensions.badges.some(badge => badge.id === id));
  }
  async close() {
    this.client?.dispose();
    if (this.server) {
      await this.server.close();
      await this.server.close(); // Public disposal is idempotent.
    }
  }
}
