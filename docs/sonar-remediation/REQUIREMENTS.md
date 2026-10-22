# Pi Chat / Sonar Remediation — Requirements

## Goal

Resolve or explicitly justify the 24 open CRITICAL/MAJOR Sonar findings on `ManuelSelch_pi-chat` without changing correct behavior solely to appease static analysis. Prioritize actual runtime risk over analyzer severity. See [REVIEW.md](./REVIEW.md) for evidence, all issue keys, proposed dispositions, and verification limits.

## Scope

### In Scope

- Review and remediation of 2 CRITICAL and 22 MAJOR findings returned by the Sonar MCP server for main.
- Linear-time path normalization, explicit model ordering, small behavior-preserving rendering/parser changes, deterministic CI binary execution, and mockup cleanup.
- Harden the Swift test fixture with fixture-owned temporary outputs (user confirmed). Remove the unused reconnect diagnostic instead of hardening it (subsequently confirmed; removed in `262c05e`).
- Focused regression tests, fresh-worktree CI verification, and evidence-based disposition of stale findings or false positives.

### Out of Scope

- The 8 MINOR issues, dependency upgrades, blanket rule disabling, blanket source exclusions, or changes to quality-gate thresholds.
- Production authentication/sandbox redesign, new mockup layouts, broad parser replacement, and unrelated code cleanup.
- Implementation of other slices as part of the approved fixture-hardening change, or changing Sonar issue statuses without approval.

## Requirements

- R1: Track all 24 findings individually through fixes or documented disposition; distinguish source changes from scanner-confirmed resolution. Reconcile the currently analyzed revision/configuration with checkout `8a42c0d`, including findings outside current `sonar.sources=src`.
- R2: Path and home normalization must process trailing separators in linear time while retaining current outputs for Unix/Windows paths, generic project names, home boundaries, empty inputs, and roots. Test adversarial slash runs without fragile wall-clock assertions.
- R3: CI must install from the committed lockfile with lifecycle scripts disabled and execute only already-installed TypeScript/Playwright binaries; missing binaries must fail rather than trigger implicit downloads. Keep source-only harness compilation, explicit SDK builds, job dependencies, and artifact handoffs working in a clean checkout.
- R4: Both model-list branches must use fixed English locale collation with deterministic ties, including mixed-case and Unicode identifiers (user confirmed). Model references, filtering, warnings, and fallback semantics must not change.
- R5: Highlight callback adapters must explicitly retain the token and sibling-index arguments; rendered text, nested highlighting classes, React keys, safe escaping, and fallback behavior must remain correct.
- R6: The Markdown scanner must advance explicitly and always make progress, preserving multiple formulas, surrounding text, display math, escaped dollars, prices, unmatched delimiters, and code content. Do not simply delete the skip-ahead assignment.
- R7: Preserve typed process-error rejection and bounded public error mapping. Verify the opener finding against a fresh scan; justify a false-positive disposition if it persists rather than inventing an error-handling defect.
- R8: Harden the Swift fixture (user confirmed). It must create its own temporary output directory instead of accepting a caller-chosen output directory, must not overwrite preexisting/symlinked outputs, must retain isolated temporary metadata and failure diagnostics, and must preserve Swift handoff/cleanup with bounded startup and termination. Test both accepted and rejected inputs with isolated resources. Delete `scripts/verify-reconnect.ts` rather than maintaining it; its removal supersedes the earlier reconnect-hardening requirement.
- R9: Remove the redundant mockup selection conditional and add meaningful static heading fallback text without redesign. Verify strict focus identity and real keyboard wrapping; do not replace `===` with `==`. Document false positives per finding instead of suppressing an entire rule or folder.
- R10: Verify changed behavior with focused tests and then the full Vitest suite and production build; verify workflow changes in clean CI, fixture changes with macOS Swift loopback tests, and mockup changes with keyboard/accessibility smoke checks. Requery Sonar after a new matching main/PR analysis and record remaining findings and gate status honestly. Document any unrelated baseline failures separately.

## Assumptions

- Scope is the current pi-chat project and main-branch Sonar findings, not a repository-wide security audit.
- The Swift fixture and caller are trusted test processes, not production HTTP endpoints. Standard OS temporary-directory configuration is trusted; this is not a sandbox against hostile processes running as the same OS user.
- Mockups remain maintained and analyzed; narrow documented false-positive dispositions are preferred over exclusions.
- Existing CI lifecycle protections are intentional and must not be undone to repair dependency preparation.

## Implementation Plan

### 1. Reconcile CI Findings

Description: Reconcile the three CI issue keys with the current workflow and analyzed configuration; retain the already-applied lifecycle-script protections. Replace implicit `npx` resolution with installed local binary execution in all applicable jobs. Verify clean installation, explicit harness/SDK compilation, build/unit/e2e artifact flow, and missing-binary failure. Record scan provenance so later resolution claims refer to the correct revision.

### 2. Make Path Normalization Linear

Description: Resolve all three regex findings with bounded trailing-separator removal shared only where useful. Add functional regression cases and long adversarial inputs for both project/home paths, preserving current root behavior. Verify focused project tests, source-level linearity, and a bounded non-gating performance probe. Independent of slice 1's code changes.

### 3. Define Model Ordering

Description: Address both critical-labeled sort findings with confirmed fixed English locale collation and deterministic tie behavior. Add mixed-case/Unicode/punctuation tests for available, scoped, and fallback lists; retain scope diagnostics and exact references. Verify the offered-model suite.

### 4. Clarify Rendering and Parser Intent

Description: Make the two highlight iterator callbacks explicit while retaining index keys; refactor the single math skip-ahead warning into clear scanner progress without changing parsing semantics. Add targeted DOM/parser regressions. Confirm typed opener rejection remains correct and document or request the individual false-positive disposition after rescanning; change callback formatting only if useful, not to fabricate a bug fix. Verify all relevant focused suites.

### 5. Resolve Diagnostic Trust Boundaries

Description: Harden the fixture/Swift handoff with isolated positive/negative tests, as confirmed by the user. Use fixture-owned temporary outputs; avoid cwd confinement that breaks legitimate OS-temp usage, handle preexisting/symlinked output risks, and bound startup/termination. Remove the unused reconnect diagnostic instead of hardening it. Do not introduce a general-purpose sandbox framework. Implemented: four new fixture regressions pass, full Vitest suite passes (1,162 tests), Swift suite passes (35 Swift Testing tests plus 6 XCTest tests), and production build/typecheck pass. Sonar closure awaits a fresh analysis.

### 6. Clean Up and Validate Mockups

Description: Resolve the redundant conditional and two static heading warnings without layout changes. Exercise default/empty/project states, project selection, heading population, Tab/Shift+Tab wrapping, and Escape across all three mockups. Keep the six correct strict focus comparisons and prepare per-issue false-positive evidence if the warnings remain; no loose equality or blanket exclusions. Use actual mockup behavior checks, not just the generic DOM probe from the review.

### 7. Verify and Reconcile Sonar Results

Description: Depends on completed applicable slices 1–6 and approved dispositions. Run focused and full tests, production build, clean CI, and the relevant Swift/browser checks. Trigger or await a fresh analysis through the normal approved workflow, query the matching main/PR issues and quality gate through MCP, and map all 24 original keys to resolved, proposed false positive, accepted, or still open with supporting evidence. Do not promise a green gate or zero issues before scanning. Commit verified changes incrementally without automatically pushing.

## Open Questions

None.
