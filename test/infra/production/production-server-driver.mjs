import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, symlink, writeFile, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { PiClient, createWebSocketTransport } from '@manuelselch/pi-sdk';
import WebSocket from 'ws';
import { resolveNpmCli } from '../../../dist/shared/node/npm-command.js';

async function until(description, check, milliseconds = 15000) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) { if (await check()) return; await delay(50); }
  throw new Error(`Timed out: ${description}`);
}
async function freePort() {
  const socket = createServer();
  await new Promise((done, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', done); });
  const port = socket.address().port;
  await new Promise((done, reject) => socket.close(error => error ? reject(error) : done()));
  return port;
}

/** Owns the real extension launcher, isolated build policy, listener, clients and successor cleanup. */
export class ProductionServerDriver {
  clients = new Set();
  constructor(directory, port) {
    this.directory = directory; this.port = port; this.pidFile = join(directory, 'tmp/pi-chat-server.pid');
    this.env = { ...process.env, PI_CHAT_HOME: directory, PI_CHAT_DEV: '0', PI_CHAT_HOST: '127.0.0.1',
      PI_CHAT_LOG_DIR: join(directory, 'logs'), PI_CHAT_CWD: join(directory, 'project'), PI_CODING_AGENT_DIR: join(directory, 'agent'),
      TMPDIR: join(directory, 'tmp'), TMP: join(directory, 'tmp'), TEMP: join(directory, 'tmp') };
  }
  static async start() {
    const directory = await mkdtemp(join(tmpdir(), 'pi chat lifecycle '));
    const driver = new ProductionServerDriver(directory, await freePort());
    try {
      await mkdir(join(directory, 'tmp')); await mkdir(join(directory, 'project'));
      await symlink(resolve('dist'), join(directory, 'dist'), 'dir');
      await writeFile(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', scripts: { build: 'node build.mjs' } }));
      // Only the failure switch is synthetic. Successful builds execute Chat's real build command.
      await writeFile(join(directory, 'build.mjs'), `import { existsSync, appendFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
appendFileSync('build-attempts', 'attempt\\n');
if (existsSync('fail-build')) { process.on('exit', () => writeFileSync('failed-build-finished', '1')); console.error('simulated build failure'); process.exit(1); }
execFileSync(process.execPath, [${JSON.stringify(resolveNpmCli())}, 'run', 'build'], { cwd: ${JSON.stringify(process.cwd())}, stdio: 'inherit' });\n`);
      const output = await driver.launcher('start', '--port', String(driver.port), '--no-open');
      assert.match(output, /Pi Chat is running:/, 'Launcher must report readiness, not merely process creation');
      await driver.ShouldServeUI();
      driver.initialPid = (await driver.pid()).pid;
      return driver;
    } catch (error) { await driver.dispose(); throw error; }
  }
  async launcher(...args) {
    const { stdout, stderr } = await promisify(execFile)(process.execPath,
      ['--import', 'tsx', fileURLToPath(new URL('./launcher.mjs', import.meta.url)), ...args],
      { cwd: process.cwd(), env: this.env, timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
    return stdout + stderr;
  }
  pid() { return readFile(this.pidFile, 'utf8').then(JSON.parse); }
  async healthy() {
    try { return (await fetch(`http://127.0.0.1:${this.port}/health`, { signal: AbortSignal.timeout(1000) })).ok; }
    catch { return false; }
  }
  async ShouldServeUI() {
    await until('isolated production health', () => this.healthy());
    const response = await fetch(`http://127.0.0.1:${this.port}/`);
    assert.equal(response.status, 200); assert.match(await response.text(), /<div id="root"><\/div>/);
    const record = await this.pid();
    assert.equal(record.port, this.port); assert.equal(record.cwd, join(this.directory, 'project'));
    process.kill(record.pid, 0);
  }
  async client() {
    const client = new PiClient({ endpoint: `ws://127.0.0.1:${this.port}/ws`, transport: createWebSocketTransport(url => new WebSocket(url)) });
    this.clients.add(client); client.start();
    await until('SDK initialization', () => client.getState().connection.phase === 'ready');
    return client;
  }
  async FailedBuildShouldKeepCurrentServer() {
    await writeFile(join(this.directory, 'fail-build'), '1');
    const client = await this.client();
    await client.restartServer();
    await until('failed build process exit', async () => {
      try { return await readFile(join(this.directory, 'failed-build-finished'), 'utf8') === '1'; } catch { return false; }
    });
    // Restart has no session-scoped operation.finished event. Observe the exited build,
    // retained PID/listener and a fresh SDK handshake instead of inventing a wire outcome.
    const retained = await this.client(); retained.dispose(); this.clients.delete(retained);
    assert.equal((await this.pid()).pid, this.initialPid);
    assert.equal((await readFile(join(this.directory, 'build-attempts'), 'utf8')).trim().split('\n').length, 2);
    await this.ShouldServeUI(); client.dispose(); this.clients.delete(client);
    await rm(join(this.directory, 'fail-build'));
  }
  async RestartShouldRewritePid() {
    const client = await this.client(); await client.restartServer();
    await until('successor PID rewrite after a real build', async () => {
      try { return (await this.pid()).pid !== this.initialPid && await this.healthy(); } catch { return false; }
    }, 120000);
    assert.equal((await readFile(join(this.directory, 'build-attempts'), 'utf8')).trim().split('\n').length, 3);
    await this.ShouldServeUI(); client.dispose(); this.clients.delete(client);
  }
  async StopShouldReleaseListenerAndFlushLogs() {
    const output = await this.launcher('stop'); assert.match(output, /stopped/i);
    await until('listener shutdown', async () => !await this.healthy());
    const records = (await readFile(join(this.directory, 'logs/pi-chat.log'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.ok(records.filter(record => record.event === 'server.started' && record.fields.projectDirectory === join(this.directory, 'project')).length >= 2);
    assert.ok(records.filter(record => record.event === 'server.shutdown').length >= 2);
  }
  async dispose() {
    for (const client of this.clients) client.dispose();
    try {
      const { pid } = await this.pid();
      try { process.kill(pid, 'SIGTERM'); } catch { /* Already stopped. */ }
      await until('owned server cleanup', async () => !await this.healthy(), 6000);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    finally { await rm(this.directory, { recursive: true, force: true }); }
  }
}
