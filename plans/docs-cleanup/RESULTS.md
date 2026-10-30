# Documentation migration result

## Scope

- User authorized the remaining documentation cleanup after two small migrations.
- This batch starts at `3e0eb8585340a67e510270af4ceed071b9b1b0a1`:
  **74 Markdown files under docs → 9 current-system guides**.
- Of the 67 legacy files removed from `docs/`, **55 are retired** after
  consolidating useful knowledge and **12 originals are retained under plans**
  for unresolved scope/approval/verification. Git retains the removed originals.
- Eleven existing image/manifest assets remain unchanged. No screenshots were
  deleted or regenerated; existing image freshness is not certified.
- Production code, executable scenarios/drivers, configuration, dependencies,
  theme files and approved mockups are unchanged. Existing active designs retain
  their content; two pre-existing broken relative links in the archive-notice
  design were repaired mechanically.

## Merge reconciliation

- Latest `main` was incorporated before merging this cleanup. Its SDK/server
  0.2.0 registry migration supersedes the local-archive state inspected above;
  maintained guides now document those releases and retain extraction attribution.
- Preserved the newer compact single-conversation worktree row behavior and its
  catalogue/live-inventory counting rules. No production conflict resolution or
  scenario changes were needed.
- Reinstalled the merged lockfile, rebuilt the source-only test harness and
  reran verification: build passed and **919 tests across 108 files** passed.

## Maintained destinations and contract locations

| Consolidated area | Current documentation / executable evidence |
|---|---|
| Package/server/SDK extraction, compiled host and Swift test ownership | [Architecture](../../docs/architecture.md#package-boundaries), [development](../../docs/development.md#server-boundary), [provenance/attribution](../../vendor/README.md), public-boundary/fixture tests linked from [test guide](../../test/README.md#contract-locations) |
| Protocol and recovery | New [integration reference](../../docs/protocol.md) links the installed SDK authority; old illustrative protocol retained with backend obligations, not presented as current schema |
| Frontend ownership, composition, styles and widget layout | [Development](../../docs/development.md#frontend-organization), [architecture](../../docs/architecture.md), existing widget DOM/browser tests |
| Completion, skills, bash, steering and shared session actions | [Usage](../../docs/usage.md), [input ownership](../../docs/architecture.md#conversation-input-and-actions), composer/action tests and permanent steering/skill/browser scenarios |
| Titles, Projects/worktrees, recency, pins, archive and Inbox | [Navigation](../../docs/architecture.md#session-navigation-and-drafts), [usage](../../docs/usage.md#sessions), project-model/browser contracts; newer approved Inbox behavior remains current |
| Focus and overlay lifecycle | [Architecture](../../docs/architecture.md#focus-and-overlays), [test discipline and commands](../../test/README.md#composer-focus-regressions); actual delayed-commit and browser assertions retained unchanged |
| Endpoint configuration, restart and logging | [Configuration](../../docs/configuration.md), [host lifecycle/security](../../docs/architecture.md#host-lifecycle-and-security), existing host/command/endpoint/npm-lookup tests |
| Rich prompts, widgets/OSC 8 and runtime/remembered themes | [Architecture](../../docs/architecture.md#runtime-prompts-widgets-and-themes), [extension API](../../docs/extension-api.md#native-pi-ui-contributions), [usage](../../docs/usage.md#extension-prompts-and-widgets), existing prompt/widget/theme contracts |
| Files and tool rendering | [File ownership](../../docs/architecture.md#file-links-and-content-presentation), [usage](../../docs/usage.md#opening-local-file-links), parser/action/rendering tests; original pending macOS/browser checks retained, not claimed complete |
| Integration drivers and harness setup | Reconciled [driver guide](../../docs/integration-tests/DRIVERS.md) and [test guide](../../test/README.md); roadmap preserved separately |
| Coverage, CI container and hardening rationale | [Development](../../docs/development.md#e2e-coverage), [CI](../../docs/development.md#ci-and-static-analysis), [trusted npm operations](../../docs/configuration.md#npm-backed-operations); dated Sonar evidence retained separately |
| README capture and static assets | [Capture guide](../../docs/readme-showcase/CAPTURE.md), source/composition/fixture tests; explicitly documents stale selector/navigation/theme assumptions without changing capture behavior |

- [Current documentation index](../../docs/README.md) is the entry point.
- [Retained scope](RETAINED.md) names every unresolved group and links the
  preserved originals. In particular, distribution-policy approval, broader
  Swift parity, pending file-opening smoke and dated Sonar closure are not
  silently declared satisfied or abandoned.
- Legacy requirements contained contradictory/stage-specific clauses: streaming
  bash versus the delivered non-streaming path, idle-only skills versus newer
  approved steering, session-menu restart versus its later removal, links-off
  widgets versus later OSC 8 support, and old no-persistence themes versus
  remembered appearance. Maintained docs describe the later implemented flows;
  no code or assertions were changed to revive earlier stages.

## Verification and limits

- Build suite passed: public dependency API/wire check, TypeScript, compiled host
  and Vite build. Existing large-chunk warning remains.
- Unit/DOM/application suite passed: **906 tests across 108 files**.
- Static checks cover local Markdown targets/maintained heading anchors, pinned
  historical link targets in local Git, archive integrity/provenance consistency,
  retained-baseline content preservation and docs-only change scope.
- Source/selected assertion inspection reconciled the published guidance, not
  every historical sentence against a freshly executed upstream test. Passing
  tests do not prove prose completeness or full legacy coverage. Current test
  locations remain discoverable without copying scenario steps into requirements.
- No browser suite, screenshot capture, controlled OS file open, production
  lifecycle smoke, package release/push, live-service restart, native UI test or
  fresh Sonar analysis was run for this batch. Capture-script drift is recorded,
  not fixed or visually verified.
- Original inventory/proposal remain as temporary review baselines, with links
  repaired to preserved sources. This result is not final feature acceptance;
  remove temporary cleanup artifacts only at authorized closeout.
