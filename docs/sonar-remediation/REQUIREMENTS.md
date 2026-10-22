# Pi Chat / Sonar Remediation — Requirements

## Goal

Resolve or explicitly justify the 24 open CRITICAL/MAJOR Sonar findings on `ManuelSelch_pi-chat` without changing correct behavior solely to appease static analysis. Prioritize actual runtime risk over analyzer severity. See [REVIEW.md](./REVIEW.md) for evidence, all issue keys, proposed dispositions, and verification limits.

## Scope

### In Scope

- Review and remediation of 2 CRITICAL and 22 MAJOR findings returned by the Sonar MCP server for main.
- Linear-time path normalization, explicit model ordering, small behavior-preserving rendering/parser changes, deterministic CI binary execution, and mockup cleanup.
- Explicit trust-boundary decisions for the Swift test fixture's output directory and reconnect diagnostic target.
- Focused regression tests, fresh-worktree CI verification, and evidence-based disposition of stale findings or false positives.

### Out of Scope

- The 8 MINOR issues, dependency upgrades, blanket rule disabling, blanket source exclusions, or changes to quality-gate thresholds.
- Production authentication/sandbox redesign, new mockup layouts, broad parser replacement, and unrelated code cleanup.
- Implementation as part of this planning request, or changing Sonar issue statuses without approval.

## Requirements

- R1: Track all 24 findings individually through fixes or documented disposition; distinguish source changes from scanner-confirmed resolution. Reconcile the currently analyzed revision/configuration with checkout `8a42c0d`, including findings outside current `sonar.sources=src`.
- R2: Path and home normalization must process trailing separators in linear time while retaining current outputs for Unix/Windows paths, generic project names, home boundaries, empty inputs, and roots. Test adversarial slash runs without fragile wall-clock assertions.
- R3: CI must install from the committed lockfile with lifecycle scripts disabled and execute only already-installed TypeScript/Playwright binaries; missing binaries must fail rather than trigger implicit downloads. Keep source-only harness compilation, explicit SDK builds, job dependencies, and artifact handoffs working in a clean checkout.
- R4: Both model-list branches must use one documented alphabetical ordering policy, including mixed-case and Unicode identifiers. Model references, filtering, warnings, and fallback semantics must not change. Resolve the proposed fixed-English locale policy before implementing it.
- R5: Highlight callback adapters must explicitly retain the token and sibling-index arguments; rendered text, nested highlighting classes, React keys, safe escaping, and fallback behavior must remain correct.
- R6: The Markdown scanner must advance explicitly and always make progress, preserving multiple formulas, surrounding text, display math, escaped dollars, prices, unmatched delimiters, and code content. Do not simply delete the skip-ahead assignment.
- R7: Preserve typed process-error rejection and bounded public error mapping. Verify the opener finding against a fresh scan; justify a false-positive disposition if it persists rather than inventing an error-handling defect.
- R8: Resolve the helper trust-boundary question before changing the CLI contract. If hardened, the fixture must not overwrite arbitrary caller-chosen/preexisting/symlinked outputs, must retain isolated temporary metadata and failure diagnostics, and must preserve Swift handoff/cleanup. The reconnect script must reject non-approved parsed targets before connecting and bound connection/read attempts and cleanup. Test both accepted and rejected inputs with isolated resources.
- R9: Remove the redundant mockup selection conditional and add meaningful static heading fallback text without redesign. Verify strict focus identity and real keyboard wrapping; do not replace `===` with `==`. Document false positives per finding instead of suppressing an entire rule or folder.
- R10: Verify changed behavior with focused tests and then the full Vitest suite and production build; verify workflow changes in clean CI, fixture changes with macOS Swift loopback tests, and mockup changes with keyboard/accessibility smoke checks. Requery Sonar after a new matching main/PR analysis and record remaining findings and gate status honestly. Document any unrelated baseline failures separately.

## Assumptions

- Scope is the current pi-chat project and main-branch Sonar findings, not a repository-wide security audit.
- The existing Swift fixture caller is trusted and owns its temporary directory; the reconnect script is a local-development diagnostic. Neither is currently a production HTTP endpoint.
- Proposed default: locale-aware English ordering with deterministic ties, retaining original model identifiers; this requires confirmation.
- Mockups remain maintained and analyzed; narrow documented false-positive dispositions are preferred over exclusions.
- Existing CI lifecycle protections are intentional and must not be undone to repair dependency preparation.

## Implementation Plan

### 1. Reconcile CI Findings

Description: Reconcile the three CI issue keys with the current workflow and analyzed configuration; retain the already-applied lifecycle-script protections. Replace implicit `npx` resolution with installed local binary execution in all applicable jobs. Verify clean installation, explicit harness/SDK compilation, build/unit/e2e artifact flow, and missing-binary failure. Record scan provenance so later resolution claims refer to the correct revision.

### 2. Make Path Normalization Linear

Description: Resolve all three regex findings with bounded trailing-separator removal shared only where useful. Add functional regression cases and long adversarial inputs for both project/home paths, preserving current root behavior. Verify focused project tests, source-level linearity, and a bounded non-gating performance probe. Independent of slice 1's code changes.

### 3. Define Model Ordering

Description: After the locale-policy question is resolved, address both critical-labeled sort findings with consistent explicit collation and deterministic tie behavior. Add mixed-case/Unicode/punctuation tests for available, scoped, and fallback lists; retain scope diagnostics and exact references. Verify the offered-model suite.

### 4. Clarify Rendering and Parser Intent

Description: Make the two highlight iterator callbacks explicit while retaining index keys; refactor the single math skip-ahead warning into clear scanner progress without changing parsing semantics. Add targeted DOM/parser regressions. Confirm typed opener rejection remains correct and document or request the individual false-positive disposition after rescanning; change callback formatting only if useful, not to fabricate a bug fix. Verify all relevant focused suites.

### 5. Resolve Diagnostic Trust Boundaries

Description: Depends on the helper-policy answer. Either harden the fixture/Swift handoff and reconnect target validation with isolated positive/negative tests, or document contextual acceptance for the three CLI findings. For hardening, avoid cwd confinement that breaks legitimate OS-temp usage, handle preexisting/symlinked output risks, and bound reconnect attempt/read cleanup. Verify fixture changes with macOS Swift tests and reconnect behavior against isolated local servers. Do not introduce a general-purpose sandbox framework.

### 6. Clean Up and Validate Mockups

Description: Resolve the redundant conditional and two static heading warnings without layout changes. Exercise default/empty/project states, project selection, heading population, Tab/Shift+Tab wrapping, and Escape across all three mockups. Keep the six correct strict focus comparisons and prepare per-issue false-positive evidence if the warnings remain; no loose equality or blanket exclusions. Use actual mockup behavior checks, not just the generic DOM probe from the review.

### 7. Verify and Reconcile Sonar Results

Description: Depends on completed applicable slices 1–6 and approved dispositions. Run focused and full tests, production build, clean CI, and the relevant Swift/browser checks. Trigger or await a fresh analysis through the normal approved workflow, query the matching main/PR issues and quality gate through MCP, and map all 24 original keys to resolved, proposed false positive, accepted, or still open with supporting evidence. Do not promise a green gate or zero issues before scanning. Commit verified changes incrementally without automatically pushing.

## Open Questions

1. May the test/dev helpers adopt stricter contracts (fixture-owned temporary outputs and loopback-only reconnect targets), or should their three findings receive documented contextual acceptance? Recommended: harden them if no external diagnostic callers depend on the current arguments.
2. Should model ordering use fixed English locale collation for reproducibility across servers, or the server's default locale? Recommended: fixed English collation with deterministic ties.
