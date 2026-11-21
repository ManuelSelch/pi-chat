# Pi workspace

- [Pi Chat](packages/pi-chat/README.md): browser application and Pi launcher extension.
- [Pi Server](packages/pi-server/README.md): HTTP/WebSocket hosting and Pi runtime integration.
- [TypeScript SDK](packages/pi-sdk-typescript/README.md): protocol, client transport and synchronized state.
- One npm workspace and lockfile; the root owns composition, CI and shared verification only.

## Development

```sh
npm ci --ignore-scripts
npm run dev
```

- `npm run build` builds SDK → Server → Chat; `npm start` starts Chat.
- `npm test` runs Chat tests; `npm run test:packages` runs SDK/Server tests.
- Run the root Pi pipeline for complete verification.
- [Development](docs/development.md), [architecture](docs/architecture.md) and [workspace layout](docs/monorepo.md).
- No packages are published by these commands. External installs need matching published dependencies or explicit artifacts.
