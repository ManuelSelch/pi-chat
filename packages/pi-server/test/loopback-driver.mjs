import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { writeFile, readFile, stat, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { PiClient, createWebSocketTransport } from '@manuelselch/pi-sdk';

export class LoopbackDriver {
  constructor(directory, specifier = new URL('../dist/testing/loopback.js', import.meta.url).href) {
    this.directory = directory; this.specifier = import.meta.resolve(specifier); this.output = '';
  }
  async start(args = []) {
    const launcher = join(this.directory, 'fixture.mjs');
    await writeFile(launcher, 'import { runLoopbackFixture } from ' + JSON.stringify(this.specifier) + '; await runLoopbackFixture();');
    this.child = spawn(process.execPath, [launcher, ...args], { cwd: this.directory,
      env: { ...process.env, PI_CODING_AGENT_DIR: join(this.directory, 'outer-agent') }, stdio: ['ignore', 'pipe', 'pipe'] });
    this.exited = once(this.child, 'exit');
    this.child.stdout.on('data', data => { this.output += data; });
    this.child.stderr.on('data', data => { this.output += data; });
    if (args.length) return;
    await this.wait(() => {
      const match = this.output.match(/PI_FIXTURE_READY (.+)\n/);
      if (match) { this.ready = JSON.parse(match[1]); return true; }
      if (this.child.exitCode !== null) throw new Error(this.output);
    });
    assert.equal(this.ready.directory, await realpath(this.ready.directory));
    assert.equal((await stat(this.ready.directory)).mode & 0o777, 0o700);
    assert.notEqual(this.ready.directory, this.directory);
    assert.equal(new URL(this.ready.endpoint).hostname, '127.0.0.1');
  }
  async wait(check) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) { if (await check()) return; await delay(20); }
    throw new Error('Fixture timeout: ' + this.output);
  }
  async connect() {
    this.client = new PiClient({ endpoint: this.ready.endpoint, transport: createWebSocketTransport(endpoint => new WebSocket(endpoint)) });
    this.client.start();
    await this.wait(() => this.client.getState().connection.phase === 'ready');
  }
  async exerciseRetainedStreaming() {
    await this.connect();
    assert.deepEqual(this.client.getState().inventory, []);
    const id = await this.client.createSession(this.ready.directory);
    await this.client.prompt(id, 'Say hello');
    await this.wait(() => this.client.getSession(id)?.draft?.text);
    await this.wait(() => this.client.getSession(id)?.messages.length === 2);
    assert.deepEqual(this.client.getSession(id).messages.map(m => m.text), ['Say hello', 'Hello from the isolated Swift demo.']);
    this.client.dispose(); await this.connect();
    assert.equal(this.client.getState().inventory.length, 1);
    await this.client.prompt(id, 'Stop this response');
    await this.wait(() => this.client.getSession(id)?.draft?.text);
    await this.client.abort(id);
    await this.wait(() => this.client.getSession(id)?.status === 'idle');
  }
  async rejectCallerPath() {
    await this.connect();
    await assert.rejects(this.client.createSession(this.directory));
  }
  async stop() {
    this.client?.dispose();
    if (!this.child || this.child.exitCode !== null || this.child.signalCode !== null) return;
    this.child.kill('SIGTERM');
    const timer = setTimeout(() => this.child.kill('SIGKILL'), 6500);
    try { assert.deepEqual(await this.exited, [0, null], this.output); }
    finally { clearTimeout(timer); }
    if (this.ready) return JSON.parse(await readFile(join(this.ready.directory, 'cleanup.json'), 'utf8'));
  }
  async cleanup() {
    try { return await this.stop(); }
    finally { if (this.ready) await rm(this.ready.directory, { recursive: true, force: true }); }
  }
  async assertRejectedArguments() {
    const timer = setTimeout(() => this.child.kill('SIGKILL'), 5000);
    try { assert.deepEqual(await this.exited, [1, null]); assert.match(this.output, /does not accept arguments/); }
    finally { clearTimeout(timer); }
  }
}
