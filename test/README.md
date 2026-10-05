# Test organization

```text
test/
├── modules/          # Focused tests grouped by production module
│   ├── shared/
│   ├── server/       # application, bootstrap, projects, runtime/pi, transport, extensions
│   ├── web/          # app, chat, sessions, extensions, settings, ui
│   └── extension/    # Pi Chat loader/build extension
├── scenarios/        # User workflows using app.* feature drivers
│   ├── chat/         # prompt/reply and abort
│   ├── browser/      # reconnect and controller takeover
│   ├── projects/     # folder selection and errors
│   └── tabs/         # independent conversations and tab lifecycle
├── infrastructure/   # Tests of drivers, clients, test worlds, and fakes
│   └── pi-chat/
├── support/          # Reusable drivers, fixtures, and fakes (not test cases)
│   └── pi-chat/
└── setup.ts          # Shared Vitest setup
```

## Placement rules

- **Modules:** mirror the production module under `src/`. Keep unit, DOM, and
  focused boundary tests together. Retain `.dom.test.tsx` for DOM tests.
  For cross-module tests, choose the module owning the behavior being verified.
- **Scenarios:** group by the user-facing feature, not by transport mechanics.
  Use semantic driver methods and blank lines between setup, workflow phases,
  and assertions. Streaming cancellation belongs to `chat/abort.test.ts`.
- **Infrastructure:** verify the test machinery itself, including isolation,
  lifecycle, cleanup, diagnostics, and bounded waits. These are not product
  scenarios, even when they start a real server or Pi session.
- **Support:** implementation used by tests; no test cases here.
- Keep new test cases out of the root `test/` directory.

## Commands

```sh
npm test                            # All tests
npm test -- test/modules             # Focused module tests
npm test -- test/scenarios           # User workflows
npm test -- test/scenarios/browser   # One scenario module
npm test -- test/infrastructure      # Driver and fixture regression tests
npm run build                       # TypeScript check and production build
npm run test:spike                   # Real Pi harness compatibility spike
```

The current scenario drivers exercise real Pi sessions and the real server over
WebSocket using production browser reducers. They do not render React or launch a
visible browser; visible UI behavior is covered separately by DOM tests.
