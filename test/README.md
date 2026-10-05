# Tests

- **`modules/`** — unit, DOM, and boundary tests grouped like `src/`.
- **`scenarios/`** — user workflows grouped by feature, using `app.*` drivers.
- **`infra/`** — reusable drivers, fixtures, clients, and fakes.
- **`infra-tests/`** — tests of that reusable machinery.
- **`setup.ts`** — shared Vitest setup.

Keep test cases out of the root folder. Separate scenario phases with blank lines.
Scenarios use real Pi sessions and WebSocket transport, not a rendered browser.

## Run

```sh
npm test                         # All tests
npm test -- test/modules         # Module tests
npm test -- test/scenarios       # User workflows
npm test -- test/infra-tests     # Test machinery
npm run build                   # Typecheck and build
```
