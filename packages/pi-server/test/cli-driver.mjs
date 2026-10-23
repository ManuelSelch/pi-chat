import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { PiClient, createWebSocketTransport } from '@manuelselch/pi-sdk';

export class CliDriver {
  constructor(directory, entry = new URL('../dist/cli.js', import.meta.url)) {
    this.directory = directory; this.entry = entry; this.output = ''; this.pids = new Set();
  }
  async start(extra = [], env = {}) {
    this.child = spawn(process.execPath, [this.entry instanceof URL ? fileURLToPath(this.entry) : this.entry,
      '--port', '0', '--project', this.directory, '--pid-file', join(this.directory, 'server.pid'),
      '--log-directory', join(this.directory, 'logs'), ...extra], {
      cwd: this.directory, env: { ...process.env, PI_CODING_AGENT_DIR: join(this.directory, 'agent'), ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.pids.add(this.child.pid);
    this.child.stdout.on('data', data => { this.output += data; });
    this.child.stderr.on('data', data => { this.output += data; });
    this.exited = once(this.child, 'exit');
    await this.wait(async () => {
      const match = this.output.match(/Pi Server: (http:\/\/[^\s]+)/);
      if (match) { this.url = match[1]; return true; }
      if (this.child.exitCode !== null) throw new Error(this.output);
      return false;
    });
  }
  async wait(check) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) { if (await check()) return; await delay(25); }
    throw new Error('CLI timeout: ' + this.output);
  }
  async assertHeadless() { assert.equal((await fetch(this.url + '/')).status, 404); }
  async assertStatic(text) { assert.equal(await (await fetch(this.url + '/nested')).text(), text); }
  async assertPidAndLog() {
    const record = JSON.parse(await readFile(join(this.directory, 'server.pid'), 'utf8'));
    assert.equal(record.pid, this.child.pid);
    assert.equal(record.port, Number(new URL(this.url).port));
    assert.equal(record.cwd, this.directory);
    await this.wait(async () => {
      try { return (await readFile(join(this.directory, 'logs/pi-chat.log'), 'utf8')).includes('server.started'); } catch { return false; }
    });
  }
  async assertRestartDisabled() {
    const socket = new WebSocket(this.url.replace('http:', 'ws:') + '/ws');
    try {
      const response = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('initialize timeout')), 5000);
        socket.addEventListener('message', event => {
          const message = JSON.parse(event.data);
          if (message.type === 'response' && message.requestId === 'init') { clearTimeout(timer); resolve(message); }
        });
      });
      await once(socket, 'open');
      socket.send(JSON.stringify({ version: 2, type: 'request', requestId: 'init', method: 'server.initialize', params: {
        client: { name: 'supervisor-test', version: '1' }, capabilities: ['server.restart'],
      } }));
      const initialized = await response;
      assert.equal(initialized.ok, true);
      assert.ok(!initialized.result.capabilities.includes('server.restart'));
    } finally { socket.close(); }
  }
  async restart() {
    const client = new PiClient({ endpoint: this.url.replace('http:', 'ws:') + '/ws',
      transport: createWebSocketTransport(endpoint => new WebSocket(endpoint)), requestTimeoutMs: 5000 });
    const ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { unsubscribe(); reject(new Error('restart SDK timeout')); }, 5000);
      const unsubscribe = client.subscribe(state => { if (state.connection.phase === 'ready') { clearTimeout(timer); unsubscribe(); resolve(); } });
    });
    try {
      client.start(); await ready;
      assert.deepEqual(client.getState().inventory, []);
      const receipt = await client.restartServer();
      assert.equal(receipt.state, 'accepted');
      await this.exited;
      await this.wait(async () => {
        const record = JSON.parse(await readFile(join(this.directory, 'server.pid'), 'utf8'));
        if (record.pid === this.child.pid) return false;
        this.pids.add(record.pid);
        // Port 0 deliberately chooses a fresh endpoint after restart.
        this.url = 'http://127.0.0.1:' + record.port;
        try { return (await fetch(this.url + '/health')).ok; } catch { return false; }
      });
    } finally { client.dispose(); }
  }
  async close(signal = 'SIGTERM') {
    for (const pid of this.pids) { try { process.kill(pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
    if (this.child && this.child.exitCode === null && this.child.signalCode === null) await this.exited;
    if (this.url) await this.wait(async () => { try { await fetch(this.url + '/health'); return false; } catch { return true; } });
  }
}
