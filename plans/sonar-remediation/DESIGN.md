> **Retained legacy baseline, not current-system documentation.** Relocated from `docs/sonar-remediation/DESIGN.md` during documentation cleanup. Original status/approval statements below are historical; outstanding scope and final acceptance are not inferred. Content is preserved with link repairs only. Missing former SDK workspace links now point to the owning SDK repository. See [retained scope](../docs-cleanup/RETAINED.md).

# Sonar Remediation — Design

## Approach

Completed scope: helper hardening (requirements R8, slice 5), linear path normalization (R2, slice 2), fixed-English model ordering (R4, slice 3), and the Markdown scanner while-loop refactor (R6, part of slice 4). Completed follow-up: production restart invocation review and the two default-parameter warnings (R11–R12, slice 8). Current implemented scope: harden the six direct executable PATH lookups (R13, slice 9). Other Sonar changes remain separate.

The confirmed fixture weakness was canonicalizing a caller-selected directory without confining writes. Remove that capability rather than build a general sandbox. The user subsequently chose to delete the unused reconnect diagnostic (`262c05e`), superseding its hardening design. Fixture design approved for implementation; unrelated Sonar work remains separate.

## Components & Data Flow

- **Changed:** `packages/pi-sdk/Tests/Fixtures/loopback-server.ts` rejects positional output-directory arguments, creates a private temporary directory itself, and keeps sessions/metadata/output files there. Its fake runtime and loopback server remain unchanged.
- **Changed:** `packages/pi-sdk/Tests/PiSDKTests/LoopbackTests.swift` launches the fixture without a directory argument. It reads a marked readiness record from stdout containing the canonical project directory and endpoint, then uses that directory for session creation and cleanup assertions. Its existing parent-owned temporary directory retains diagnostic logs.
- **Removed:** `scripts/verify-reconnect.ts`; do not recreate it.
- **New, test-only:** `LoopbackFixture.swift` owns the Swift subprocess and diagnostics. `test/infra/swift-fixture-driver.ts` owns subprocess setup, readiness, teardown and assertions for `test/infra-tests/swift-fixture.test.ts`. No production service layer.

## Key Implementation Details

Create the fixture directory with `mkdtemp` under the OS temporary directory, canonicalize it, and use restrictive permissions. No CLI argument controls its location. Create output files exclusively (`wx`) so existing files or symlinks are rejected rather than followed or replaced. The old endpoint-file polling is replaced by one prefixed JSON stdout record emitted only after listening:

```ts
type FixtureReady = { directory: string; endpoint: string };
// PI_FIXTURE_READY {"directory":"…","endpoint":"ws://127.0.0.1:…/ws"}
```

The Swift driver directs stdout/stderr to its existing style of regular diagnostic file (avoiding pipe backpressure and concurrent readers), polls complete lines for the readiness prefix, and enforces the ten-second startup deadline. All other output remains available as diagnostics. Parent-side cleanup removes the reported private fixture directory after success, but retains artifacts on failure. Register bounded termination early so startup failures do not leave a server running. Keep cleanup reports exclusively created in the fixture directory. This protects against accidental/argument-driven overwrites, not hostile processes running as the same OS user.

The Swift driver permits six seconds for graceful shutdown, then kills/reaps the child if necessary. Failure/cancellation before readiness and driver destruction also terminate the subprocess. Throwing test assertions preserve failure artifacts instead of deleting diagnostics after a failed expectation.

### Linear path normalization

Keep a private `normalizeDisplayPath(path: string): string` helper in `src/server/projects/project-display.ts`. Replace backslashes with forward slashes, then decrement an end index while the preceding character is `/`, and return one slice. Both project formatters use this helper, covering the project path and home path without changing their remaining logic. Each character is visited at most a bounded number of times; no regex search or repeated slicing occurs in the loop.

Preserve current behavior for empty strings, slash-only roots, Windows drive roots, UNC paths, generic directory names, home boundaries and case handling. In particular, do not replace this display-only normalization with filesystem `normalize`/`resolve`, collapse internal separators, or change the empty-home early return. Add focused pure-function tests in `test/modules/server/projects/project-display.test.ts`. Run adversarial cases in a subprocess with a generous safety deadline, so a regression cannot block the test worker; do not assert machine-specific timings or speed ratios.

### Fixed-English model ordering

Keep one private `compareModelReferences(left: string, right: string): number` comparator beside `modelReference` in `src/server/runtime/pi/models.ts`. Compare full provider/model references with `left.localeCompare(right, "en")`. If English collation returns equality for different strings (for example composed and decomposed accents), fall back to ordinal string comparison. Exact equal strings compare as zero. Use the comparator in both existing sorts so available, scoped and fallback lists follow the same policy regardless of catalogue input order or server default locale. Do not normalize, rename or deduplicate references, change scope resolution or warnings, or apply natural numeric ordering. Fixed English means independence from server locale, not frozen collation data across all future ICU versions.

Extend `offered-models.test.ts` with an injectable catalogue and explicit expected mixed-case, accented, punctuation and numeric-identifier ordering. Cover no shortlist, empty shortlist, scoped results and no-match fallback with forward/reversed catalogue order. Include collating-equivalent but byte-distinct identifiers to prove the deterministic tie-breaker preserves both exact strings. Keep existing filtering and fallback tests.

### Markdown scanner advancement

In `parseInlineMathText` in `src/web/chat/markdown/remark-display-math.ts`, move the scan index initialization before a `while (index < text.length)` loop. When a character is not an opening delimiter, or no closing delimiter is found, increment the index before continuing. After emitting a formula, set the text cursor to `close + 1` and set the scan index to that cursor. This exactly replaces the former `index = close` plus the for-loop increment; it must not rescan consumed content or skip the next character. Leave delimiter predicates, closing-delimiter search, node metadata, display promotion and Markdown integration unchanged. This is maintainability cleanup, not a newly discovered parser bug or a promise of linear-time parsing.

Add pure AST characterization tests in `test/modules/web/chat/markdown/remark-display-math.test.ts` for plain/empty text, multiple/adjacent formulas, leading/trailing text, unmatched delimiters before/after valid formulas, escaped dollars, prices, whitespace and code nodes. Run these against the original implementation before refactoring; existing behavior is expected to pass. Keep existing DOM rendering tests for display/inline math and safe rendering. No new dependencies or public parser APIs.

### Parameter defaults — approved and implemented follow-up

The two `typescript:S7737` findings are maintainability warnings, not confirmed runtime defects. Keep changes in the existing bootstrap composition root and transport command handler; no new service layer or exports.

In `src/server/bootstrap/server.ts`, introduce a private `createDefaultRuntimeFactory(): RuntimeAdapterFactory` returning the existing three delegate methods. Use `factory: RuntimeAdapterFactory = createDefaultRuntimeFactory()` in the existing parameter position. This removes the literal default while retaining a fresh factory for each omitted/undefined argument, lazy invocation of `PiRuntimeAdapter` methods, and caller-supplied factory identity. Do not replace the default with a shared mutable singleton.

In `src/server/transport/command-handler.ts`, make the nested `completed` helper's result optional and select the fresh fallback in its return expression:

```ts
result: result === undefined ? { state: "completed" } : result
```

Keep `afterResponse` forwarding unchanged. In particular, `null`, false, zero and empty-string results must not become the fallback. Existing calls passing `undefined` plus a callback must retain the completed payload and callback.

Before refactoring, add focused characterization tests in the mirrored bootstrap and transport test directories: default factory delegation for all three methods with isolated mocks (no real SDK sessions), supplied factory bypass, completion fallback for ping/explicit-undefined mutation, fresh completion payloads across calls, explicit null/falsy payload preservation, and callback forwarding. Characterization tests should pass on the original implementation: do not invent a failing behavior assertion for an intentional behavior-preserving cleanup. Run focused restart/default suites, full Vitest tests, production build/typecheck and whitespace checks afterward. Fresh Sonar analysis verifies rule closure; local green tests alone do not.

Verification: 12 new characterization cases pass before and after the refactor; 18 focused tests pass including the six existing restart tests. All 1,229 tests (145 files), production build/typecheck and whitespace checks pass. Production restart code is unchanged. Existing Vite chunk-size and mixed static/dynamic import notices remain; the build succeeds. Sonar closure awaits a matching new analysis.

The restart review is documentation-only in this slice. Keep inherited-PATH execution unchanged pending a separate deployment-policy decision; do not hardcode `/usr/bin/npm`, substitute an unverified `npm_execpath`, or silently strip version-manager paths. See REVIEW.md for evidence and limitations.

### Explicit executable resolution — approved and implemented follow-up

**Policy:** trust the Node/npm installation selected when the operator launches the process, not arbitrary entries in inherited PATH. Add one small Node-only helper in `src/shared/node/npm-command.ts`, genuinely reused by restart, README capture and SDK verification. Resolve the absolute `npm` entry beside `process.execPath` with `realpathSync`; require a regular npm CLI file (`bin/npm-cli.js`) and matching npm package metadata. Homebrew's sibling npm symlink legitimately resolves outside the versioned Node directory; permit that installed symlink rather than imposing an incorrect prefix restriction. No PATH search, `npm_execpath` override, shell wrapper execution, dependency installation or system-wide npm-path assumption. Missing/nonstandard installations fail with an actionable error; custom npm layouts and Windows wrappers are not supported by this first policy.

Expose a narrow resolver returning the canonical npm CLI path. Callers keep subprocess ownership and execute `process.execPath` with `[npmCli, ...existingArgs]`. Validate lazily before each operation. Restart catches resolution failures and returns its existing build-failure message without scheduling a successor or shutting down; capture/verification fail nonzero. Preserve all existing cwd, stdio, packaging/prepack arguments and lifecycle settings. The Node-only helper compiles with the existing server/shared build. Plain `.mjs` source tools import its `.ts` source using the project's supported Node >=22.19 native type stripping; the tsx capture tool and compiled server retain their respective normal module paths. Keep the helper free of non-erasable TypeScript and source-only runtime imports.

In memory diagnostics, use `/bin/ps` for macOS/Linux and `/usr/bin/vmmap` on macOS only; Linux retains no vmmap measurement. Check platform/tool availability and report a clear error, without command-name fallback. Preserve current measurement arguments, parsing and subprocess cleanup. The two metric functions live in `scripts/server-memory/metrics.mjs` so command selection and error cases can be unit-tested without launching either comparison server. The comparison script retains lifecycle ownership.

**Trust limit:** installation-path and metadata checks establish expected layout, not authenticity. Trusted installations may be user-owned (Homebrew/nvm). Do not claim protection from same-user replacement, compromised dependencies, malicious npm configuration or downstream build scripts; their existing environment remains trusted. No indiscriminate PATH stripping or broad subprocess framework.

**Tests:** first reproduce poisoned-PATH selection with harmless isolated fake executables, then prove the new calls ignore them. Cover sibling npm symlinks including Homebrew layout, missing/invalid npm entry or metadata, ignored hostile npm_execpath, original arguments, direct-script Node execution, and npm resolution/build failure preserving the live server. Use test-only subprocess drivers for fixture setup and bounded cleanup; never invoke the real restart/shutdown path. Cover ps/vmmap platform selection and missing-command diagnostics. Run real resolved `npm --version`, SDK offline package verification, full Vitest, production build/typecheck and whitespace checks. Actual Linux behavior is confirmed in CI; local macOS tests alone do not establish cross-platform success. Sonar closure requires a fresh matching scan.

Executable verification: 28 new tests pass (34 focused including the existing restart suite). The old restart invocation failed the explicit-command and resolution-failure cases; the new resolver/module cases initially failed before implementation. A harmless poisoned npm reproduces the old PATH selection and is ignored by installation-bound invocation. All 1,257 Vitest tests (149 files), production build/typecheck, SDK offline package verification and whitespace checks pass. Native Node source imports and compiled helper execution pass; the real Homebrew npm reports version 11.17.0, and actual `/bin/ps` plus `/usr/bin/vmmap` measurements succeed locally. Capture's command is tested at its subprocess boundary and its `--help` startup passes; no screenshot regeneration was performed. Linux execution and scanner-confirmed closure await CI/new analysis. Configuration documentation describes the supported installation policy. No dependencies, lockfiles or Sonar statuses changed.

### npm resolver coverage — approved and implemented follow-up

**Confirmed cause:** `ExecutablePathDriver.resolveCli` imports and executes `npm-command.ts` in a standalone Node subprocess. Vitest's V8 report does not merge that child process's coverage. Caller tests mock the resolver, so they do not cover its implementation either. Existing behavioral tests are present; the report cannot see their resolver execution.

**Approach:** add focused in-process unit tests in `test/modules/shared/node/npm-command.test.ts`, using real temporary installation fixtures and directly importing `resolveNpmCli`. Cover normal/external npm symlinks, the default running Node installation, relative inputs, missing entry, invalid filename/parent directory, non-file CLI, malformed JSON, null/missing/incorrect package metadata, and error wrapping with the underlying cause. Keep filesystem setup/cleanup in test-only helpers; do not mutate PATH or npm_execpath in the shared test worker.

Retain the existing subprocess suite for poisoned-environment and native Node execution checks. Do not change production code, weaken coverage inclusion or add child-coverage aggregation infrastructure. Verify with focused V8 coverage (aiming for complete statements, branches and functions for this helper), existing executable-resolution/caller suites, build/typecheck and whitespace checks.

**Approval:** the user approved this test-only follow-up with “yes do it”.

**Verification:** 17 direct unit cases pass with 100% V8 statements, branches, functions and lines for `npm-command.ts` (enforced by focused-run coverage thresholds). All 35 focused resolver, subprocess and caller tests pass; production build/typecheck and whitespace checks pass. Existing Vite bundle-size and mixed-import warnings remain. No production code or coverage configuration changed; fresh hosted coverage/Sonar analysis remains pending.

## Complexity Guardrails

No new dependencies, DNS resolution, remote-host override, generic filesystem sandbox, production transport changes, or unrelated Sonar fixes. Standard OS temporary-directory configuration remains trusted.

## Verification

Four new subprocess regressions failed on the old fixture and pass after hardening: argument rejection, private/canonical workspace and readiness handoff with clean shutdown, and exclusive-write failure on preexisting files and symlinks. The old Swift caller also failed against the new argument contract before its handoff was updated. Full Vitest suite: 1,162 passed; Swift Testing: 35 passed; XCTest: 6 passed. Production build/typecheck and whitespace checks pass. A fresh Sonar analysis remains necessary to confirm findings close.

Path verification: 24 new cases pass (43 with existing project-service coverage). The long-input subprocess exceeded its ten-second safety deadline on the original regex; it now completes comfortably. A non-gating probe normalized 200,000-slash inputs across all three sites in approximately 0.06 ms on this machine. Full suite rerun: 1,186 tests passed; production build/typecheck and whitespace checks passed. The first full run hit a lazy-Markdown UI timeout; that suite passed alone and in the full rerun without unrelated changes. Sonar closure still awaits new analysis.

Model-order verification: eight new cases failed under the original default sorts and pass after the shared comparator change. All 17 offered-model tests pass, including existing filtering/fallback behavior. Full suite: 1,194 tests passed; production build/typecheck and whitespace checks passed. Scope is limited to ordering; no provider/model identifiers or catalogue objects are mutated. Sonar closure of the two critical-labeled sort findings still requires a fresh analysis.

Markdown verification: 16 pure AST characterization cases and the existing DOM suite pass before and after the while-loop refactor (39 focused tests). Full suite: 1,217 tests passed after restoring dependencies from the committed lockfile with `npm ci --ignore-scripts` and explicitly compiling the source-only harness/SDK. The first full run was blocked by a missing `monocart-coverage-reports` package from recent coverage work; no package/lockfile change was needed. Production build/typecheck and whitespace checks pass. Dependency installation reported 12 npm audit findings (including 3 critical); these were not investigated or modified in this parser refactor. Scanner issue closure requires a fresh Sonar analysis.

## Decisions for Approval

None. The user approved the installation-bound npm policy, fail-closed behavior for unsupported/missing npm layouts and fixed macOS/Linux system-tool paths with “looks good. implementit”. Slice 9 is implemented and locally verified. This changes executable selection, not npm build-script sandboxing.

The parameter-default design was approved with “implement the parameter defaults fix” and is implemented and locally verified, preserving fresh objects and exact undefined/null behavior.

Earlier approvals: the user approved fixture hardening and the stdout readiness handoff, separately approved deletion of the reconnect script, requested the backward-scan path fix after seeing the concrete algorithm, approved fixed-English model sorting with a deterministic tie-breaker, and explicitly approved the Markdown scanner while-loop refactor after its advancement behavior was explained.
