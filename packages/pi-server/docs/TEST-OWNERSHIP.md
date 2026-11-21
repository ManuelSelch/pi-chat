# Test ownership

| Owner | Responsibility | Local verification |
|---|---|---|
| pi-server | Server behavior, public exports/CLI, compiled loopback fixture, isolation and shutdown receipt | `npm test`, `npm run typecheck`, `npm run verify:package` |
| [pi-sdk-swift](https://github.com/ManuelSelch/pi-sdk-swift/tree/main/integration) | Swift unit/probe tests and real URLSession compatibility against its locked published npm server | Root `swift build` / `swift test`; separate integration npm install/test |
| Pi Chat | Web/Node application and installed-dependency acceptance | Chat unit, browser, build and lifecycle suites; no Swift harness or SDK bundle |

The fixture is a public **compiled server export**, not Swift source. It owns the
private canonical workspace, fake deterministic runtime, ephemeral loopback
listener and exclusive shutdown receipt. Consumer drivers own bounded waits,
process termination, diagnostics and removal of successful artifacts.

`test/loopback.test.mjs` checks streaming/Stop, retained runtimes and explicit
shutdown close, rejection of caller-selected project paths and argument rejection.
Its driver checks canonical/private workspace permissions and loopback binding.
`verify:package` repeats these scenarios through documented installed exports in
an isolated packed consumer without Chat, frontend dependencies or tsx.

Chat also retains plain-Node installed-fixture acceptance checks, including refusal
to overwrite an existing cleanup file or symlink. Those two checks are **not**
duplicated by this repository's current fixture suite. They remain covered in Chat,
not dropped or represented as server-owned regressions. None uses Swift tooling.
Cross-language compatibility itself belongs solely to the Swift repository.

## S3 verification — 2026-10-25

Clean source export of `2e25017ebf28a5d290f1cd6c5cede790321211e7`
(server 0.1.1), in a temporary directory with spaces; Node 24.22.1:

- `npm ci --ignore-scripts`: passed with the committed lockfile.
- `npm run typecheck`: passed.
- `npm test`: **435 unit tests / 60 files** and **16 compiled-package tests**.
- `npm run test:coverage`: **435 passed**, **85.59% line coverage**.
- `npm run verify:package`: **16 installed-package tests passed**, plus public
  declaration compilation, transitive registry SDK 0.1.0 and export-boundary checks.

The Swift suite independently passed against its existing **published server 0.1.0**
lock. This is not a Swift compatibility claim for server 0.1.1; changing that pin
requires separate dependency verification. No API/protocol or dependency changes
were needed for S3.

The server install reported **5 npm audit findings (4 moderate, 1 high)**; no audit
fix was applied. No live model, remote CI/Sonar run, branch-protection change,
publication, push or live-service restart was performed.
