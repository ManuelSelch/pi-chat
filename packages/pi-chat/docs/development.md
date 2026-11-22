# Chat development

- Run workspace installation and shared verification from the repository root; see the [system development guide](../../../docs/development.md).
- Chat commands run in this package directory: `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`, `npm run test:production-smoke`.
- Build/test hooks delegate SDK/Server builds to root composition and compile the source-only test harness using resolved package paths, not a fixed `node_modules` location.
- `dist/`, browser artifacts and local coverage belong here. No generated output is committed.
- ESLint, TypeScript, Vite, Vitest and Playwright configuration belong here. Paths below are relative to this package.
- Use `npm run capture:readme` only for explicitly requested screenshot capture; see the [capture guide](readme-showcase/CAPTURE.md).

## Frontend organization

- Follows [Bulletproof React’s folder conventions](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md), without changing runtime behavior or existing dependency boundaries.
- `src/web/app/` owns startup, composition, transport binding (`lib/`), application state (`stores/`), hooks, shell and overlays.
- `src/web/features/` contains `chat/`, `sessions/`, `settings/` and `extensions/`. Each retains its capability modules, such as `sessions/inbox/` and `chat/composer/`.
- Within a capability, `components/` owns views and containers, `hooks/` owns React coordination, `stores/` owns stateful providers, `lib/` owns storage/I/O adapters and `utils/` owns pure rules. Only needed folders exist; there are no `domain/`, `infra/` or nested feature `app/` layers.
- Shared `components/`, `hooks/`, `config/`, `lib/`, `types/` and `utils/` sit directly under `src/web/`. Shared primitives and theme modules do not import app or feature presentation.
- Keep `*Container` names for state/context wiring and `*View`/prop-driven components for presentation. A container is not necessarily a navigable page; existing Home/Inbox page components retain their names. CSS modules stay beside their components.
- Module tests and local fixtures live in `__test__/` inside their module, for example `features/chat/composer/__test__/`. Cross-feature scenarios, reusable drivers and runner setup live in this package's `testing/`.
- Prefer direct file imports. Server settings retains its existing entry at `features/settings/server/index.ts`; no new barrel files or cross-feature import restrictions are introduced.
- Existing composition remains explicit: `usePiChat` coordinates Inbox lifecycle and endpoint loading; `AppControllerProvider` composes prompt presentation, theme, drafts and file actions. Feature containers still consume app context, and rich prompts still reuse chat’s lazy Markdown renderer.
- `AppOverlays` assembles prompts, session dialogs, navigation, folders and Settings. Settings stays mounted while closed; chime playback now belongs to the independent [chimes plugin provider](../../../plugins/chimes/README.md), not the drawer lifetime. App owns Home/transcript selection, responsive workspace geometry and composer height.
- Global layer order, Markdown styles, widget container queries and shared animations remain in `app/styles.css`; widget rendering, geometry and placement remain separate modules under `features/extensions/widgets/`.

See the [architecture overview](../../../docs/architecture.md) for state ownership and runtime flow, and the [testing guide](../testing/README.md) for placement and workflow coverage.
