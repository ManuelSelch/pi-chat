# Plugin host integration

- [Chat's Node host](../src/host/index.ts) awaits `createPiServer` before installing routes or listening.
- Pi Server accepts explicit `plugins`, activates host entries once per server instance, and resolves only after readiness. No default feature plugins are activated.
- Plugin startup precedes HTTP/WebSocket construction; failed startup rolls back instead of exposing a partially ready server.
- Server close owns transport, plugin and session teardown; Chat still owns its injected logger, signals and PID records.
- Session-level Pi extensions remain distinct from server-scoped plugin activation.
- Host runtime implementation/tests are owned by [Pi Server](https://github.com/ManuelSelch/pi-server), not copied into Chat. See its installed [lifecycle guide](../node_modules/@manuelselch/pi-server/docs/PLUGINS.md) after `npm ci`.
- File opening remains an inactive scaffold. No web plugin runtime or plugin transport is wired into Chat.
