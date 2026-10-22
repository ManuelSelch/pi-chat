# Critical and major Sonar findings — Review

## Scope and evidence

- Project: `ManuelSelch_pi-chat`, analyzed branch `main`; MCP reports latest analysis `2026-10-22T16:49:47+0000`.
- Reviewed checkout: `8a42c0d`. Sonar locations refer to the analyzed revision and do not always match current lines.
- Corrected inventory: **24 findings: 2 CRITICAL and 22 MAJOR**, not the previously reported 23. The other 8 open issues are MINOR and outside this review.
- Sources: Sonar MCP issue search, branch listing, quality gate, rule descriptions, current source, direct callers, package lock, and existing tests.
- Current gate: ERROR on `new_security_rating` (3, required 1); other returned conditions pass. Do not assume this review alone explains every gate metric.
- No production code or Sonar issue statuses changed. Proposed dispositions below require verification against a fresh scan.

## Implementation follow-up

- The user chose deletion over hardening for `scripts/verify-reconnect.ts`; removed in `262c05e`.
- Swift fixture hardening is implemented: fixture-owned private temporary directory, stdout readiness handoff, exclusive cleanup-report creation, and bounded Swift subprocess ownership with retained failure logs.
- Four new subprocess regressions and the updated real-server Swift integration test pass. Full verification: 1,162 Vitest tests, 35 Swift Testing tests plus 6 XCTest tests, production build/typecheck, and whitespace checks pass.
- Linear path normalization is also implemented: one private backward-scan helper replaces all three trailing-slash regex sites, preserving display behavior. Added 24 regressions covering roots, empty-home bypass, Windows/UNC paths, home boundaries, internal separators and adversarial slash runs. The old regex exceeded a ten-second subprocess safety deadline; the replacement passes. Full suite rerun: 1,186 tests pass; build/typecheck and whitespace checks pass. The first full run had a lazy-Markdown UI timeout which passed in isolation and on full rerun without UI changes.
- Fixed-English model ordering is implemented in both available/scoped list sorts, with an ordinal tie-breaker for collating-equivalent references. Eight new regressions cover unscoped, empty/scoped shortlist and no-match fallback modes in forward/reversed catalogue order, retaining identifiers and warnings. All 17 offered-model tests and the full 1,194-test suite pass; production build/typecheck and whitespace checks pass.
- The Markdown scanner now uses a while loop: non-openers/unmatched delimiters advance one character, consumed formulas jump directly to the character after the closer. Sixteen characterization cases and existing DOM coverage pass before/after (39 focused tests). Full suite: 1,217 tests pass; build/typecheck and whitespace checks pass. Missing locked coverage dependencies were restored without changing package manifests. npm installation reported 12 unreviewed dependency audit findings (3 critical), outside this refactor.
- Latest MCP recheck before the scanner change: analysis `2026-10-22T18:11:42+0000`, quality gate OK, new-code coverage 95.2%, 18 open findings (10 MAJOR, 8 MINOR), with previous CLI/regex/sort findings no longer returned as open. Scanner closure awaits a fresh analysis. No issue statuses were manually changed. The original review below describes the pre-fix source; remaining unrelated slices have not been implemented by this work.

## Executive summary

No remotely exploitable critical vulnerability was established in this scoped review. The clearest confirmed production defect is super-linear path normalization on long slash runs. The two CRITICAL findings are locale-sensitive ordering concerns, while several MAJOR findings are maintainability warnings, stale CI findings, or likely analyzer false positives. Test/dev CLI findings deserve an explicit trust-boundary decision rather than being presented as exposed production endpoints.

## Findings and proposed dispositions

### 1. Quadratic path normalization — confirmed, medium priority (3 MAJOR)

- Rule: `typescript:S8786`.
- Location: `src/server/projects/project-display.ts:7,17,18`.
- Keys: `AaFkVrKuIWcgPfQvFeSR`, `AaFkVrKuIWcgPfQvFeSS`, `AaFkVrKuIWcgPfQvFeST`.
- The unanchored start of the trailing-slash regex permits retrying a long slash run at each position when it is followed by a non-slash. Both path and home-path normalization execute this work synchronously.
- Reproduction: applying the exact regex to a slash prefix followed by `x` took approximately 10.22/42.22/166.99 ms for 4,000/8,000/16,000 slashes on this machine. This is diagnostic evidence, not a portable timing assertion.
- Impact: avoidable event-loop blocking; practical severity is limited by trusted/local path inputs. No unauthenticated remote exploit was demonstrated.
- Plan: replace trailing-slash removal with a bounded backward scan, preserving current normalization and root behavior. Test slash runs, ordinary paths, Windows separators, home boundaries, generic directory names, empty strings, and roots. Do not silently change root semantics during this fix.

### 2. CI install and execution — partly already addressed (3 MAJOR)

- Location in Sonar: `.github/workflows/tests.yml:29,43`; current workflow has been split into jobs.
- Keys/rules:
  - `AaFkWUGsZ9C1aw8Vdf8-` / `githubactions:S6505`: installation without `--ignore-scripts`.
  - `AaFkWUGtZ9C1aw8Vdf8_` / `githubactions:S6505`: `npx` on-demand execution.
  - `AaFkWUGtZ9C1aw8Vdf9A` / `githubactions:S8543`: unspecified package version.
- Current source uses `npm ci --ignore-scripts` in all three installing jobs and `npx --ignore-scripts` for TypeScript and Playwright. The install-lifecycle warning is already addressed in source; it must not be counted as a new required code fix.
- `package-lock.json` pins installed TypeScript 7.0.2 and Playwright 1.63.0. Therefore normal execution after `npm ci` uses local verified versions, not an unpinned download. However, `npx` still leaves an unnecessary implicit resolution/fallback path if the expected local binary is absent.
- Plan: invoke the installed local binaries directly in all affected jobs; fail if they are missing. Preserve explicit compilation of the pinned source-only test harness and the SDK build that replaces skipped `prepare`. Do not replace lockfile-based versions with separately maintained hardcoded versions.
- Verify in a clean CI checkout with lifecycle scripts disabled; rerun Sonar before declaring the old keys fixed. Main analysis can be stale or use different configuration; it currently still lists mockups/scripts despite `sonar.sources=src` in this checkout.

### 3. Fixture path writes — trusted test invocation, optional hardening (2 MAJOR)

- Rule: `tssecurity:S8707`.
- Location: `packages/pi-sdk/Tests/Fixtures/loopback-server.ts:75,76`.
- Keys: `AaFkVrJiIWcgPfQvFeSE`, `AaFkVrJiIWcgPfQvFeSD`.
- `realpath(process.argv[2])` canonicalizes but does not confine the chosen directory. A caller can choose an arbitrary existing writable directory; fixed filenames such as `endpoint.tmp`/`endpoint` can then be overwritten. Existing child symlinks are another concern for writes.
- Actual caller: `packages/pi-sdk/Tests/PiSDKTests/LoopbackTests.swift` creates a UUID-owned directory under the OS temporary directory, canonicalizes it, and passes that literal path. The fixture uses a fake runtime and binds to `127.0.0.1`. No remote request controls its output directory.
- Assessment: real unrestricted CLI capability, but no demonstrated privilege crossing in the actual test call chain. The agentic rule assumes an untrusted/LLM-controlled CLI argument; it is not evidence of a production path-traversal endpoint.
- Preferred hardening if requested: use a newly created fixture-owned temporary directory rather than accepting an arbitrary writable destination, with a narrow handoff to the Swift parent. Preserve failure-log retention and cleanup. Alternatively validate canonical temp ownership/containment and reject preexisting output files/symlinks; checking a basename prefix alone is insufficient.
- Do not confine to repository cwd: the legitimate Swift caller intentionally uses the OS temporary directory. Decide hardening versus documented contextual acceptance before implementation.

### 4. Reconnect diagnostic URL — dev-only trust boundary (1 MAJOR)

- Rule/key: `tssecurity:S8703` / `AaFkVrK8IWcgPfQvFeSa`.
- Location: `scripts/verify-reconnect.ts:16`.
- The CLI accepts an arbitrary WebSocket URL. It is not a server endpoint; a trusted local operator normally chooses the target. No application credential forwarding was observed. Nevertheless, an agent-controlled invocation can cause unexpected outbound connections.
- Plan if hardened: restrict this local-development diagnostic to parsed WebSocket URLs with explicit numeric loopback hosts, approved schemes, no credentials, and no redirect following. Support IPv4/IPv6 loopback and valid custom ports; avoid DNS-name checks that can rebind. Reject inputs before connection attempts. Do not apply a generic SSRF rule that bans loopback: loopback is this script's intended destination.
- Add bounded per-attempt connection/read timeouts and close failed sockets so the overall deadline remains meaningful; currently an open connection that never sends a message can wait indefinitely. This is adjacent hardening of the same flow, not proof of the reported SSRF exploit.
- Confirm whether remote diagnostic targets are needed; otherwise use local-only behavior.

### 5. Model sorting — low product risk despite CRITICAL label (2 CRITICAL)

- Rule: `typescript:S2871`.
- Location: `src/server/runtime/pi/models.ts:21,31`.
- Keys: `AaFkfU0eESiijjIYdZv6`, `AaFkfU0eESiijjIYdZv7`.
- Both arrays contain provider/model strings, not numbers. The current default UTF-16 sort is deterministic and valid for identifiers, but not natural locale-aware alphabetical order. There is no critical security impact here.
- Example: `provider/Zeta` precedes `provider/alpha` with current sorting; English locale collation reverses that order and places accented names naturally.
- Plan: use the same explicit locale-aware comparator on both branches with a documented locale policy and deterministic tie handling. Preserve exact identifiers, scope matching, diagnostic warnings, and fallback behavior. A fixed English collation policy is a proposed assumption, not an approved product decision.
- Test mixed case, accents, punctuation, both scoped/unscoped branches, and fallback. Existing tests primarily cover lowercase ASCII identifiers.

### 6. Highlight callbacks — intentional use of index, low-priority cleanup (2 MAJOR)

- Rule: `typescript:S7727`.
- Location: `src/web/chat/tools/FileHighlight.tsx:12,17`.
- Keys: `AaFkfU0DESiijjIYdZv4`, `AaFkfU0DESiijjIYdZv5`.
- `tokenNode(token, key)` deliberately receives the array index as the React sibling key. The third iterator argument is ignored; the usual callback-arity bug is not present.
- Plan: explicitly forward both token and index through wrappers at both levels to make the intent analyzer-visible. Do not forward only the token and accidentally lose keys. Preserve safe text/span-only rendering and plain-text fallback.
- Test nested token text/classes, sibling-key warnings, unknown language, invalid snippet fallback, and literal HTML-like content.

### 7. Promise rejection — likely false positive (1 MAJOR)

- Rule/key: `typescript:S6671` / `AaFkfU0lESiijjIYdZv8`.
- Location: `src/server/files/system-file-opener.ts:25`.
- `execFile`'s callback supplies `Error | null`; the truthy branch rejects with that Error. The outer catch emits a bounded `FileOpenError`. Existing tests cover nonzero exit, missing binary, termination, and synchronous exceptions.
- Plan: prefer documenting/triaging this as false positive once confirmed on a fresh scan. If a readability cleanup is wanted, expand the ternary callback into explicit branches without wrapping or losing the original error merely to satisfy the analyzer.
- Preserve `/usr/bin/open`, argument separation, `shell: false`, timeout, and private-output redaction.

### 8. Markdown loop advance — intentional parser behavior (1 MAJOR)

- Rule/key: `typescript:S2310` / `AaFkVrKXIWcgPfQvFeSQ`.
- Location: `src/web/chat/markdown/remark-display-math.ts:98`.
- `index = close` deliberately skips the formula just consumed. Deleting it would reprocess formula contents and can duplicate or misparse subsequent formulas. This is not an early exit or a demonstrated infinite loop.
- Plan: express the scanner with explicit cursor advancement and guaranteed progress rather than a for-counter reassignment. Preserve inline/display distinctions, escaped dollars, prices, unmatched delimiters, text boundaries, and multiple formulas. Avoid broad parser changes in this slice.

### 9. Mockup findings — 1 real redundancy, 8 contextual warnings (9 MAJOR)

- Identical conditional: `mockups/projects-single-column/main.js:59`, `javascript:S3923`, key `AaFkVrKQIWcgPfQvFeSK`. Both outer branches assign exactly the same project expression. Remove only the redundant condition, retaining the `state=project` behavior.
- Focus comparisons: `javascript:S3403`, keys `AaFkVrKQIWcgPfQvFeSL`, `AaFkVrKQIWcgPfQvFeSM` (projects-single-column:220–221); `AaFkVrKVIWcgPfQvFeSO`, `AaFkVrKVIWcgPfQvFeSP` (quick-chats:84–85); `AaFkVrKOIWcgPfQvFeSI`, `AaFkVrKOIWcgPfQvFeSJ` (project-archive:93–94).
  - These compare `document.activeElement` with actual drawer controls and can be true. A local jsdom probe focused two buttons and confirmed both identity comparisons return true. This is supporting DOM evidence, not a complete test of the three mockups' keyboard flows.
  - Treat as likely false positives. Never change strict identity to loose equality merely because Sonar suggests it. Verify Tab/Shift+Tab wrapping and Escape in the actual mockups before requesting disposition.
- Empty headings: `Web:S6850`, keys `AaFkVrKUIWcgPfQvFeSN` (quick-chats/index.html:13), `AaFkVrKNIWcgPfQvFeSH` (project-archive/index.html:12).
  - Both headings are populated synchronously by initial `render()` before showing the drawer. No persistent empty heading was established, but meaningful static fallback content is an inexpensive accessibility improvement if initialization fails and resolves the static warning.
- Keep mockups analyzed by default; do not use blanket exclusions to hide these findings. They are not shipped production UI. No layout redesign is required.

## Verification performed

- Five focused Vitest files passed: **73 tests** covering offered models, project session/display behavior, system file opener, Markdown, and file content.
- Command: `node_modules/.bin/vitest run test/modules/server/runtime/pi/offered-models.test.ts test/modules/server/projects/project-session-service.test.ts test/modules/server/files/system-file-opener.test.ts test/modules/web/chat/markdown/markdown.dom.test.tsx test/modules/web/chat/tools/file-content.dom.test.tsx`.
- Bounded regex timing probe, model-order demonstration, and DOM focus identity probe ran successfully without changing source.
- Full suite, production build, browser keyboard checks, Swift loopback tests, clean dependency installation, and a new Sonar analysis were **not** run during this planning-only review. They are implementation verification requirements, not completed fixes.
