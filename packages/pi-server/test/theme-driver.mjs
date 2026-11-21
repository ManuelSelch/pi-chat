import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { PiClient, createWebSocketTransport } from '@manuelselch/pi-sdk';
import { createPiRuntimeAdapter, createPiServer } from '../dist/index.js';

/** Isolated real Pi resources/extensions + public server + validated SDK/socket. */
export class ThemeDriver {
  static async run(directory, scenario) {
    const driver = new ThemeDriver(directory);
    try { await driver.start(); await scenario(driver); }
    finally { await driver.close(); }
  }
  constructor(directory) { this.directory = directory; this.runtimes = new Map(); this.created = 0; this.messages = []; }
  async start() {
    this.themeDirectory = new URL('modes/interactive/theme/', import.meta.resolve('@earendil-works/pi-coding-agent'));
    this.project = join(this.directory, 'project');
    this.otherProject = join(this.directory, 'other');
    await mkdir(this.project); await mkdir(this.otherProject);
    this.extension = join(this.directory, 'theme-extension.ts');
    await writeFile(this.extension, `export default pi => { pi.on('session_start', (_, ctx) => ctx.ui.setWidget('theme', [ctx.ui.theme.fg('accent', ctx.ui.theme.bold('Custom widget'))])); };`);
    this.server = await createPiServer({ runtimeFactory: {
      newSession: cwd => this.makeRuntime(cwd, this.nextSelection ?? (cwd === this.project ? 'light/custom' : 'light')),
      openSession: () => assert.fail('opening an already-running runtime must reuse its palette'),
      continueProject: () => assert.fail('unexpected continue'),
    }, catalogue: { lister: { listAll: async () => [] }, discovery: { forDirectory: async () => undefined }, metadataFile: join(this.directory, 'metadata.json'), homeDirectory: null } });
    this.server.httpServer.listen(0, '127.0.0.1'); await once(this.server.httpServer, 'listening');
    this.client = new PiClient({ endpoint: `ws://127.0.0.1:${this.server.httpServer.address().port}/ws`, capabilities: ['presentation'],
      transport: createWebSocketTransport(endpoint => {
        const socket = new WebSocket(endpoint);
        socket.addEventListener('message', event => this.messages.push(JSON.parse(event.data)));
        return socket;
      }) });
    this.client.start(); await this.ready();
  }
  async ready() {
    if (this.client.getState().connection.phase === 'ready') return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { unsubscribe(); reject(new Error('theme client readiness timeout')); }, 5000);
      const unsubscribe = this.client.subscribe(state => {
        if (state.connection.phase === 'ready' || state.connection.phase === 'failed') {
          clearTimeout(timer); unsubscribe();
          if (state.connection.phase === 'failed') reject(new Error(JSON.stringify(state.connection))); else resolve();
        }
      });
    });
  }
  async makeRuntime(cwd, selection) {
    this.created++;
    const agentDir = join(this.directory, 'agent-' + this.created); await mkdir(agentDir);
    const path = join(agentDir, 'custom.json');
    const json = JSON.parse(await readFile(new URL('light.json', this.themeDirectory), 'utf8'));
    json.name = 'custom'; json.colors.accent = '#123456'; json.export = { pageBg: '#fafafa', cardBg: '#ffffff', infoBg: '#eeeeee' };
    await writeFile(path, JSON.stringify(json));
    const settingsManager = SettingsManager.inMemory({ theme: selection });
    const resourceLoader = new DefaultResourceLoader({ cwd, agentDir, settingsManager, additionalThemePaths: [path], additionalExtensionPaths: [this.extension], noSkills: true, noPromptTemplates: true });
    await resourceLoader.reload();
    assert.ok(resourceLoader.getThemes().themes.some(theme => theme.name === 'custom'));
    const { session } = await createAgentSession({ cwd, agentDir, settingsManager, resourceLoader, sessionManager: SessionManager.create(cwd, join(agentDir, 'sessions')) });
    session.sessionManager.appendMessage({ role: 'user', content: 'Isolated theme fixture', timestamp: Date.now() });
    const adapter = createPiRuntimeAdapter({ session, cwd, dispose: async () => session.dispose() });
    this.runtimes.set(session.sessionId, { adapter, settingsManager, path, session });
    await session.bindExtensions({ uiContext: adapter.uiContext(), mode: 'rpc' });
    return adapter;
  }
  async createCustomSession() {
    const opened = await this.client.request('session.create', { projectPath: this.project });
    this.id = opened.snapshot.sessionId; this.path = opened.snapshot.sessionPath; this.palette = opened.theme;
    assert.equal(opened.theme.name, 'custom');
    assert.equal(opened.theme.appearance, 'light');
    assert.equal(opened.theme.colors.accent, '#123456');
    assert.deepEqual(opened.theme.surfaces, { pageBg: '#fafafa', cardBg: '#ffffff', infoBg: '#eeeeee' });
    assert.match(opened.snapshot.presentation.widgets[0].lines[0], /\x1b\[38;2;18;52;86m/);
    assert.match(opened.snapshot.presentation.widgets[0].lines[0], /\x1b\[1m/);
    assert.deepEqual(this.client.getState().themes[this.id], opened.theme);
  }
  async shouldIsolateRuntimePalettes() {
    const opened = await this.client.request('session.create', { projectPath: this.otherProject });
    assert.equal(opened.theme.name, 'light');
    assert.notEqual(opened.theme.colors.accent, '#123456');
    assert.deepEqual(this.client.getState().themes[this.id], this.palette);
    assert.equal(this.runtimes.size, 2);
    const [one, two] = [...this.runtimes.values()];
    assert.notEqual(one.adapter.uiContext().theme, two.adapter.uiContext().theme);
  }
  async shouldReuseCachedThemeOnOpenAndReload() {
    const runtime = [...this.runtimes.values()][0];
    const instance = runtime.adapter.uiContext().theme;
    runtime.settingsManager.setTheme('light');
    await writeFile(runtime.path, 'invalid after creation');
    const opened = await this.client.request('session.open', { sessionPath: this.path });
    assert.equal(opened.snapshot.sessionId, this.id); assert.equal(this.created, 2);
    assert.deepEqual(opened.theme, this.palette);
    await this.client.reloadSession(this.id);
    assert.equal(runtime.adapter.uiContext().theme, instance);
    assert.deepEqual(runtime.adapter.sessionTheme(), this.palette);
    assert.deepEqual(this.client.getState().themes[this.id], this.palette);
  }
  async shouldOpenWithFallbackForInvalidSelection() {
    this.nextSelection = 'missing-theme';
    const opened = await this.client.request('session.create', { projectPath: this.otherProject });
    assert.equal(opened.theme.name, 'dark');
    assert.equal(opened.theme.appearance, 'dark');
    assert.deepEqual(this.client.getState().themes[opened.snapshot.sessionId], opened.theme);
  }
  async shouldKeepThemesOutOfOtherPayloads() {
    const snapshot = await this.client.request('session.snapshot', {}, this.id);
    assert.equal('theme' in snapshot, false);
    this.client.stop(); this.client.start(); await this.ready();
    for (const message of this.messages) {
      const openResult = message.type === 'response' && message.ok && message.result?.theme;
      if (openResult) {
        const { theme, ...rest } = message.result;
        assert.equal(JSON.stringify(rest).includes('"theme":'), false);
        assert.equal(JSON.stringify(theme).includes(this.directory), false);
      } else assert.equal(JSON.stringify(message).includes('"theme":'), false);
    }
    assert.deepEqual(this.client.getState().themes[this.id], this.palette);
  }
  async close() { this.client?.dispose(); await this.server?.close(); }
}
