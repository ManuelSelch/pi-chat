# Development

[← README](../README.md) · [Architecture](architecture.md) · [Extension API](extension-api.md)

## Local workflow

Use Node.js 22.19 or newer. From the repository checkout:

```sh
npm ci
npm run dev
```

The development command runs the backend with `tsx watch` and the frontend with
Vite. For a production build and compiled backend:

```sh
npm run build
npm start
```

Generated `dist/` artifacts are local and are not committed. See
[Configuration](configuration.md) for server environment variables.

## Verification

```sh
npm test
npx tsc --noEmit
npm run test:e2e
npm run test:production-smoke
```

Browser tests require Chromium (`npx playwright install chromium`). Tests are
grouped under `test/modules/` (production modules), `test/scenarios/` (user
workflows), and `test/infra-tests/` (tests of reusable machinery). Reusable
support lives under `test/infra/`. See the [testing guide](../test/README.md) for
placement rules and focused commands.

To compare fresh-process server memory:

```sh
npm run measure:server-memory
```

The memory comparison starts both launch modes without open sessions; it is a
baseline, not a prediction for a long-running server with large transcripts.

To regenerate the README showcase, run `npm run capture:readme`. See the
[capture guide](readme-showcase/CAPTURE.md) for isolation, output files, and options.

## Server organization

`src/server/index.ts` is the process entry point. Server code is grouped by ownership:

- `bootstrap/`: HTTP server composition and process restart.
- `application/`: chat coordination and open-session registry.
- `transport/`: WebSocket connections and protocol handling.
- `runtime/contracts.ts`: runtime adapter, factory, event, and snapshot contracts.
- `runtime/pi/`: Pi adapter, browser UI bridge, and SDK cache workaround.
- `projects/`: session catalogue and directory browsing.
- `extensions/`: web extension registry; `extensions/ui/` contains prompt, widget, and status registries.

The test fake lives in `test/infra/fake-runtime-adapter.ts`, separate from production
contracts. The old `src/server/extension-registry.ts` import remains a deprecated
compatibility re-export of `extensions/extension-registry.ts`.

## Frontend organization

`src/web/` has six responsibility owners:

- `app/`: startup, composition, state/transport, shell, overlays, and global keyboard routing.
- `chat/`: transcript, Markdown, tool results, and composer.
- `sessions/`: Home, tabs, project/folder browsing, Quick Switcher, and session dialogs.
- `settings/`: settings controls and persistent browser preferences.
- `extensions/`: runtime slots, prompts, widgets, and footer metadata.
- `ui/`: application-independent primitives, theme, and generic confirmation.

Application services depend on shared types and other services, not presentation.
Feature containers may consume app context/state and overlay coordination; views
stay prop-driven. Only app composition imports the shell and `AppOverlays`.
Shared UI has no app/feature dependencies; extension views do not import chat or
shell components. Use direct file imports, including type-only imports, without
barrels or compatibility shims.

`AppOverlays` assembles overlays in their existing order; providers remain in
`App`. Settings stays mounted while closed to preserve chime playback. App owns
Home/transcript selection, composer height, and widget docking.

See the [web organization plan](web-organization/REQUIREMENTS.md) for detailed
boundaries and migration history, and the [architecture overview](architecture.md)
for component diagrams and data flow.
