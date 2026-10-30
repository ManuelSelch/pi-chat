# Documentation inventory

- Baseline: `68bc869399cb4f06ed70346775f31e28ca85af55` (before this report).
- Scope: every tracked file under `docs/`: **76 Markdown documents and 11 assets**. Existing `plans/`, mockups, source, tests and repository guides were scanned for incoming references, not selected for cleanup.
- Method: tracked text files up to 1 MB; Markdown inline links, backticked document paths and literal root-relative `docs/...` file mentions. Per-source-line/target edges are deduplicated. Binary assets are inventoried without visual inspection.
- Limits: static discovery, not a complete Markdown parser. Fenced examples and historical inventories can produce non-live references; dynamic paths, arbitrary prose, reference-style links, external repositories and untracked files are not exhaustively resolved. No heading-anchor validation, remote fetching or behavioral verification. An absent incoming reference does not prove a file is disposable.
- Snapshot: **129 reference edges** into `docs/` (including historical/literal mentions), **5 missing-target candidates**, **6 machine-local absolute-link occurrences**. The capture-guide candidate is an intentional root-README example, not a broken navigational link.
- Disposition proposals: [PLAN.md](PLAN.md). No existing document, asset, scenario or mockup was changed to produce this inventory.

## Files

| File | Bytes | Lines | Incoming reference edges |
|---|---:|---:|---:|
| [docs/architecture.md](../../docs/architecture.md) | 6487 | 169 | 3 |
| [docs/argument-completion/REQUIREMENTS.md](../../docs/argument-completion/REQUIREMENTS.md) | 4480 | 63 | 1 |
| [docs/backend-sdk/CUTOVER.md](../../docs/backend-sdk/CUTOVER.md) | 3344 | 55 | 6 |
| [docs/backend-sdk/PROTOCOL.md](../../docs/backend-sdk/PROTOCOL.md) | 27703 | 407 | 5 |
| [docs/backend-sdk/REQUIREMENTS.md](../../docs/backend-sdk/REQUIREMENTS.md) | 35935 | 128 | 3 |
| [docs/backend-sdk/V1-INVENTORY.md](../../docs/backend-sdk/V1-INVENTORY.md) | 26246 | 190 | 2 |
| [docs/bash-commands/REQUIREMENTS.md](../../docs/bash-commands/REQUIREMENTS.md) | 10115 | 128 | 1 |
| [docs/composer-focus/DESIGN.md](../../docs/composer-focus/DESIGN.md) | 4288 | 40 | 2 |
| [docs/composer-focus/REGRESSIONS.md](../../docs/composer-focus/REGRESSIONS.md) | 8808 | 105 | 3 |
| [docs/composer-focus/REQUIREMENTS.md](../../docs/composer-focus/REQUIREMENTS.md) | 7395 | 55 | 2 |
| [docs/configuration.md](../../docs/configuration.md) | 8592 | 159 | 5 |
| [docs/custom-server/DESIGN.md](../../docs/custom-server/DESIGN.md) | 5113 | 42 | 0 |
| [docs/custom-server/IMPLEMENTATION.md](../../docs/custom-server/IMPLEMENTATION.md) | 2320 | 22 | 0 |
| [docs/custom-server/REQUIREMENTS.md](../../docs/custom-server/REQUIREMENTS.md) | 5662 | 33 | 0 |
| [docs/development.md](../../docs/development.md) | 6547 | 103 | 6 |
| [docs/extension-api.md](../../docs/extension-api.md) | 2866 | 124 | 4 |
| [docs/file-capabilities/REQUIREMENTS.md](../../docs/file-capabilities/REQUIREMENTS.md) | 14084 | 166 | 1 |
| [docs/integration-tests/DRIVERS.md](../../docs/integration-tests/DRIVERS.md) | 11408 | 220 | 3 |
| [docs/integration-tests/REQUIREMENTS.md](../../docs/integration-tests/REQUIREMENTS.md) | 19131 | 411 | 3 |
| [docs/mcp-runtime/DESIGN.md](../../docs/mcp-runtime/DESIGN.md) | 2382 | 34 | 1 |
| [docs/npm-dependencies/DESIGN.md](../../docs/npm-dependencies/DESIGN.md) | 2363 | 22 | 0 |
| [docs/npm-dependencies/VERIFICATION.md](../../docs/npm-dependencies/VERIFICATION.md) | 1598 | 12 | 0 |
| [docs/pi-chat-classic-theme/DESIGN.md](../../docs/pi-chat-classic-theme/DESIGN.md) | 2826 | 33 | 0 |
| [docs/pi-chat-commands/DESIGN.md](../../docs/pi-chat-commands/DESIGN.md) | 4244 | 45 | 0 |
| [docs/pi-chat-commands/REQUIREMENTS.md](../../docs/pi-chat-commands/REQUIREMENTS.md) | 2027 | 25 | 0 |
| [docs/pi-server-extraction/BOUNDARIES.md](../../docs/pi-server-extraction/BOUNDARIES.md) | 18071 | 105 | 2 |
| [docs/pi-server-extraction/DESIGN.md](../../docs/pi-server-extraction/DESIGN.md) | 3351 | 21 | 2 |
| [docs/pi-server-extraction/HANDOVER.md](../../docs/pi-server-extraction/HANDOVER.md) | 5875 | 36 | 3 |
| [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md) | 41518 | 659 | 1 |
| [docs/pi-server-extraction/REQUIREMENTS.md](../../docs/pi-server-extraction/REQUIREMENTS.md) | 12068 | 55 | 3 |
| [docs/pi-server-extraction/S2-PACKAGING.md](../../docs/pi-server-extraction/S2-PACKAGING.md) | 6803 | 52 | 2 |
| [docs/pi-server-extraction/S3-EXTRACTION.md](../../docs/pi-server-extraction/S3-EXTRACTION.md) | 6446 | 47 | 2 |
| [docs/pi-server-extraction/S4-CUTOVER.md](../../docs/pi-server-extraction/S4-CUTOVER.md) | 8899 | 52 | 5 |
| [docs/pi-server-extraction/SDK-DESIGN.md](../../docs/pi-server-extraction/SDK-DESIGN.md) | 3069 | 22 | 1 |
| [docs/pi-theme/DESIGN.md](../../docs/pi-theme/DESIGN.md) | 9961 | 55 | 1 |
| [docs/pi-theme/REQUIREMENTS.md](../../docs/pi-theme/REQUIREMENTS.md) | 5964 | 38 | 1 |
| [docs/pi-theme/S2-VERIFICATION.md](../../docs/pi-theme/S2-VERIFICATION.md) | 3487 | 28 | 0 |
| [docs/pi-theme/S3-VERIFICATION.md](../../docs/pi-theme/S3-VERIFICATION.md) | 4676 | 29 | 1 |
| [docs/pi-theme/S4-VERIFICATION.md](../../docs/pi-theme/S4-VERIFICATION.md) | 3414 | 24 | 0 |
| [docs/playwright-container/DESIGN.md](../../docs/playwright-container/DESIGN.md) | 2303 | 28 | 1 |
| [docs/playwright-coverage/DESIGN.md](../../docs/playwright-coverage/DESIGN.md) | 5034 | 54 | 1 |
| [docs/project-archive-flow/REQUIREMENTS.md](../../docs/project-archive-flow/REQUIREMENTS.md) | 20055 | 173 | 1 |
| [docs/projects-panel/DESIGN.md](../../docs/projects-panel/DESIGN.md) | 5842 | 50 | 1 |
| [docs/projects-panel/REGRESSIONS.md](../../docs/projects-panel/REGRESSIONS.md) | 2403 | 22 | 0 |
| [docs/projects-panel/REQUIREMENTS.md](../../docs/projects-panel/REQUIREMENTS.md) | 7964 | 59 | 1 |
| [docs/quick-switcher/REQUIREMENTS.md](../../docs/quick-switcher/REQUIREMENTS.md) | 5751 | 55 | 1 |
| [docs/quiz-prompts/IMPLEMENTATION.md](../../docs/quiz-prompts/IMPLEMENTATION.md) | 3304 | 35 | 0 |
| [docs/readme-showcase/CAPTURE.md](../../docs/readme-showcase/CAPTURE.md) | 4261 | 65 | 2 |
| [docs/readme-showcase/REQUIREMENTS.md](../../docs/readme-showcase/REQUIREMENTS.md) | 5188 | 50 | 1 |
| [docs/remember-theme/DESIGN.md](../../docs/remember-theme/DESIGN.md) | 3738 | 41 | 0 |
| [docs/remove-session-rename/REQUIREMENTS.md](../../docs/remove-session-rename/REQUIREMENTS.md) | 7200 | 94 | 1 |
| [docs/server-organization/REQUIREMENTS.md](../../docs/server-organization/REQUIREMENTS.md) | 22023 | 262 | 1 |
| [docs/server-production-build/REQUIREMENTS.md](../../docs/server-production-build/REQUIREMENTS.md) | 8106 | 62 | 1 |
| [docs/session-open-performance.md](../../docs/session-open-performance.md) | 4685 | 87 | 1 |
| [docs/shared-session-actions/DESIGN.md](../../docs/shared-session-actions/DESIGN.md) | 1486 | 33 | 0 |
| [docs/shared-session-actions/REQUIREMENTS.md](../../docs/shared-session-actions/REQUIREMENTS.md) | 7382 | 59 | 1 |
| [docs/skill-commands/REQUIREMENTS.md](../../docs/skill-commands/REQUIREMENTS.md) | 11516 | 66 | 1 |
| [docs/sonar-remediation/DESIGN.md](../../docs/sonar-remediation/DESIGN.md) | 19673 | 113 | 1 |
| [docs/sonar-remediation/REQUIREMENTS.md](../../docs/sonar-remediation/REQUIREMENTS.md) | 12239 | 90 | 1 |
| [docs/sonar-remediation/REVIEW.md](../../docs/sonar-remediation/REVIEW.md) | 20198 | 138 | 2 |
| [docs/steering/REQUIREMENTS.md](../../docs/steering/REQUIREMENTS.md) | 8098 | 60 | 5 |
| [docs/swift-test-ownership/DESIGN.md](../../docs/swift-test-ownership/DESIGN.md) | 4234 | 45 | 0 |
| [docs/swift-test-ownership/REQUIREMENTS.md](../../docs/swift-test-ownership/REQUIREMENTS.md) | 2061 | 28 | 3 |
| [docs/swift-test-ownership/S2-VERIFICATION.md](../../docs/swift-test-ownership/S2-VERIFICATION.md) | 2928 | 30 | 1 |
| [docs/swift-test-ownership/S3-VERIFICATION.md](../../docs/swift-test-ownership/S3-VERIFICATION.md) | 3132 | 49 | 0 |
| [docs/tagged-dependencies/DESIGN.md](../../docs/tagged-dependencies/DESIGN.md) | 2962 | 23 | 0 |
| [docs/tagged-dependencies/REQUIREMENTS.md](../../docs/tagged-dependencies/REQUIREMENTS.md) | 9668 | 46 | 0 |
| [docs/usage.md](../../docs/usage.md) | 5721 | 108 | 2 |
| `docs/web-organization/REQUIREMENTS.md` (retired; [current guidance](../../docs/development.md#frontend-organization)) | 23058 | 314 | 2 |
| [docs/websocket-logging/REQUIREMENTS.md](../../docs/websocket-logging/REQUIREMENTS.md) | 4739 | 50 | 1 |
| [docs/widget-colors/ANSI-PROBE.md](../../docs/widget-colors/ANSI-PROBE.md) | 7980 | 93 | 2 |
| [docs/widget-colors/DESIGN.md](../../docs/widget-colors/DESIGN.md) | 7018 | 65 | 0 |
| [docs/widget-colors/IMPLEMENTATION.md](../../docs/widget-colors/IMPLEMENTATION.md) | 6811 | 62 | 0 |
| [docs/widget-grid/DESIGN.md](../../docs/widget-grid/DESIGN.md) | 3030 | 40 | 0 |
| [docs/widget-links/DESIGN.md](../../docs/widget-links/DESIGN.md) | 2700 | 48 | 0 |
| [docs/worktree-projects/REQUIREMENTS.md](../../docs/worktree-projects/REQUIREMENTS.md) | 12037 | 136 | 2 |
| [docs/images/pi-chat-commands.png](../../docs/images/pi-chat-commands.png) | 1075386 | binary | 1 |
| [docs/images/pi-chat-home.png](../../docs/images/pi-chat-home.png) | 838064 | binary | 1 |
| [docs/images/pi-chat-latex.png](../../docs/images/pi-chat-latex.png) | 980838 | binary | 1 |
| [docs/images/pi-chat-session-light.png](../../docs/images/pi-chat-session-light.png) | 1288313 | binary | 1 |
| [docs/images/pi-chat-session.png](../../docs/images/pi-chat-session.png) | 1127509 | binary | 1 |
| [docs/images/showcase/light.png](../../docs/images/showcase/light.png) | 147088 | binary | 1 |
| [docs/images/showcase/manifest.json](../../docs/images/showcase/manifest.json) | 304 | 18 | 1 |
| [docs/images/showcase/pi-chat-showcase.png](../../docs/images/showcase/pi-chat-showcase.png) | 384424 | binary | 2 |
| [docs/images/showcase/projects.png](../../docs/images/showcase/projects.png) | 48105 | binary | 1 |
| [docs/images/showcase/quick-switcher.png](../../docs/images/showcase/quick-switcher.png) | 47060 | binary | 1 |
| [docs/images/showcase/workspace.png](../../docs/images/showcase/workspace.png) | 138055 | binary | 1 |

## Incoming references by target

- Locations below refer to the baseline, not future rewritten line numbers. Historical inventories count as references, not runtime dependencies.

### docs/architecture.md

- [README.md](../../README.md), line 33.
- [docs/development.md](../../docs/development.md), line 102.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 23.

### docs/argument-completion/REQUIREMENTS.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 24.

### docs/backend-sdk/CUTOVER.md

- [docs/backend-sdk/PROTOCOL.md](../../docs/backend-sdk/PROTOCOL.md), line 5.
- [docs/backend-sdk/PROTOCOL.md](../../docs/backend-sdk/PROTOCOL.md), line 407.
- [docs/backend-sdk/REQUIREMENTS.md](../../docs/backend-sdk/REQUIREMENTS.md), line 96.
- [docs/backend-sdk/V1-INVENTORY.md](../../docs/backend-sdk/V1-INVENTORY.md), line 5.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 25.
- [docs/pi-server-extraction/REQUIREMENTS.md](../../docs/pi-server-extraction/REQUIREMENTS.md), line 28.

### docs/backend-sdk/PROTOCOL.md

- [docs/backend-sdk/V1-INVENTORY.md](../../docs/backend-sdk/V1-INVENTORY.md), line 159.
- [docs/backend-sdk/V1-INVENTORY.md](../../docs/backend-sdk/V1-INVENTORY.md), line 177.
- [docs/backend-sdk/V1-INVENTORY.md](../../docs/backend-sdk/V1-INVENTORY.md), line 180.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 26.
- [docs/pi-server-extraction/REQUIREMENTS.md](../../docs/pi-server-extraction/REQUIREMENTS.md), line 28.

### docs/backend-sdk/REQUIREMENTS.md

- [docs/backend-sdk/PROTOCOL.md](../../docs/backend-sdk/PROTOCOL.md), line 407.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 27.
- [docs/pi-server-extraction/REQUIREMENTS.md](../../docs/pi-server-extraction/REQUIREMENTS.md), line 4.

### docs/backend-sdk/V1-INVENTORY.md

- [docs/backend-sdk/REQUIREMENTS.md](../../docs/backend-sdk/REQUIREMENTS.md), line 84.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 28.

### docs/bash-commands/REQUIREMENTS.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 29.

### docs/composer-focus/DESIGN.md

- [docs/composer-focus/REGRESSIONS.md](../../docs/composer-focus/REGRESSIONS.md), line 73.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 30.

### docs/composer-focus/REGRESSIONS.md

- [docs/composer-focus/DESIGN.md](../../docs/composer-focus/DESIGN.md), line 40.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 31.
- [test/README.md](../../test/README.md), line 25.

### docs/composer-focus/REQUIREMENTS.md

- [docs/composer-focus/REGRESSIONS.md](../../docs/composer-focus/REGRESSIONS.md), line 3.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 32.

### docs/configuration.md

- [README.md](../../README.md), line 31.
- [docs/custom-server/REQUIREMENTS.md](../../docs/custom-server/REQUIREMENTS.md), line 30.
- [docs/development.md](../../docs/development.md), line 23.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 33.
- [docs/pi-theme/S4-VERIFICATION.md](../../docs/pi-theme/S4-VERIFICATION.md), line 9.

### docs/custom-server/DESIGN.md

- None found by this scan.

### docs/custom-server/IMPLEMENTATION.md

- None found by this scan.

### docs/custom-server/REQUIREMENTS.md

- None found by this scan.

### docs/development.md

- [README.md](../../README.md), line 32.
- [docs/architecture.md](../../docs/architecture.md), line 108.
- [docs/configuration.md](../../docs/configuration.md), line 26.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 34.
- [test/README.md](../../test/README.md), line 21.
- [vendor/README.md](../../vendor/README.md), line 7.

### docs/extension-api.md

- [README.md](../../README.md), line 34.
- [docs/pi-server-extraction/BOUNDARIES.md](../../docs/pi-server-extraction/BOUNDARIES.md), line 56.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 35.
- [docs/server-organization/REQUIREMENTS.md](../../docs/server-organization/REQUIREMENTS.md), line 156.

### docs/file-capabilities/REQUIREMENTS.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 36.

### docs/integration-tests/DRIVERS.md

- [docs/integration-tests/REQUIREMENTS.md](../../docs/integration-tests/REQUIREMENTS.md), line 16.
- [docs/integration-tests/REQUIREMENTS.md](../../docs/integration-tests/REQUIREMENTS.md), line 28.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 48.

### docs/integration-tests/REQUIREMENTS.md

- [docs/integration-tests/DRIVERS.md](../../docs/integration-tests/DRIVERS.md), line 220.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 49.
- [docs/remove-session-rename/REQUIREMENTS.md](../../docs/remove-session-rename/REQUIREMENTS.md), line 73.

### docs/mcp-runtime/DESIGN.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 50.

### docs/npm-dependencies/DESIGN.md

- None found by this scan.

### docs/npm-dependencies/VERIFICATION.md

- None found by this scan.

### docs/pi-chat-classic-theme/DESIGN.md

- None found by this scan.

### docs/pi-chat-commands/DESIGN.md

- None found by this scan.

### docs/pi-chat-commands/REQUIREMENTS.md

- None found by this scan.

### docs/pi-server-extraction/BOUNDARIES.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 3.
- [docs/pi-server-extraction/REQUIREMENTS.md](../../docs/pi-server-extraction/REQUIREMENTS.md), line 30.

### docs/pi-server-extraction/DESIGN.md

- [docs/pi-server-extraction/BOUNDARIES.md](../../docs/pi-server-extraction/BOUNDARIES.md), line 5.
- [docs/pi-server-extraction/REQUIREMENTS.md](../../docs/pi-server-extraction/REQUIREMENTS.md), line 6.

### docs/pi-server-extraction/HANDOVER.md

- [docs/backend-sdk/PROTOCOL.md](../../docs/backend-sdk/PROTOCOL.md), line 5.
- [docs/pi-server-extraction/REQUIREMENTS.md](../../docs/pi-server-extraction/REQUIREMENTS.md), line 6.
- [vendor/README.md](../../vendor/README.md), line 17.

### docs/pi-server-extraction/INVENTORY.md

- [docs/pi-server-extraction/BOUNDARIES.md](../../docs/pi-server-extraction/BOUNDARIES.md), line 9.

### docs/pi-server-extraction/REQUIREMENTS.md

- [docs/backend-sdk/REQUIREMENTS.md](../../docs/backend-sdk/REQUIREMENTS.md), line 4.
- [docs/pi-server-extraction/BOUNDARIES.md](../../docs/pi-server-extraction/BOUNDARIES.md), line 5.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 51.

### docs/pi-server-extraction/S2-PACKAGING.md

- [docs/pi-server-extraction/BOUNDARIES.md](../../docs/pi-server-extraction/BOUNDARIES.md), line 5.
- [docs/pi-server-extraction/HANDOVER.md](../../docs/pi-server-extraction/HANDOVER.md), line 5.

### docs/pi-server-extraction/S3-EXTRACTION.md

- [docs/pi-server-extraction/HANDOVER.md](../../docs/pi-server-extraction/HANDOVER.md), line 5.
- [docs/pi-server-extraction/REQUIREMENTS.md](../../docs/pi-server-extraction/REQUIREMENTS.md), line 6.

### docs/pi-server-extraction/S4-CUTOVER.md

- [docs/architecture.md](../../docs/architecture.md), line 108.
- [docs/development.md](../../docs/development.md), line 77.
- [docs/pi-server-extraction/HANDOVER.md](../../docs/pi-server-extraction/HANDOVER.md), line 5.
- [docs/pi-server-extraction/HANDOVER.md](../../docs/pi-server-extraction/HANDOVER.md), line 36.
- [docs/pi-server-extraction/REQUIREMENTS.md](../../docs/pi-server-extraction/REQUIREMENTS.md), line 29.

### docs/pi-server-extraction/SDK-DESIGN.md

- [docs/pi-server-extraction/DESIGN.md](../../docs/pi-server-extraction/DESIGN.md), line 4.

### docs/pi-theme/DESIGN.md

- [docs/remember-theme/DESIGN.md](../../docs/remember-theme/DESIGN.md), line 4.

### docs/pi-theme/REQUIREMENTS.md

- [docs/pi-theme/DESIGN.md](../../docs/pi-theme/DESIGN.md), line 4.

### docs/pi-theme/S2-VERIFICATION.md

- None found by this scan.

### docs/pi-theme/S3-VERIFICATION.md

- [docs/pi-theme/S4-VERIFICATION.md](../../docs/pi-theme/S4-VERIFICATION.md), line 19.

### docs/pi-theme/S4-VERIFICATION.md

- None found by this scan.

### docs/playwright-container/DESIGN.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 52.

### docs/playwright-coverage/DESIGN.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 53.

### docs/project-archive-flow/REQUIREMENTS.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 54.

### docs/projects-panel/DESIGN.md

- [docs/projects-panel/REQUIREMENTS.md](../../docs/projects-panel/REQUIREMENTS.md), line 48.

### docs/projects-panel/REGRESSIONS.md

- None found by this scan.

### docs/projects-panel/REQUIREMENTS.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 55.

### docs/quick-switcher/REQUIREMENTS.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 56.

### docs/quiz-prompts/IMPLEMENTATION.md

- None found by this scan.

### docs/readme-showcase/CAPTURE.md

- [docs/development.md](../../docs/development.md), line 69.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 57.

### docs/readme-showcase/REQUIREMENTS.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 58.

### docs/remember-theme/DESIGN.md

- None found by this scan.

### docs/remove-session-rename/REQUIREMENTS.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 59.

### docs/server-organization/REQUIREMENTS.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 60.

### docs/server-production-build/REQUIREMENTS.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 61.

### docs/session-open-performance.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 62.

### docs/shared-session-actions/DESIGN.md

- None found by this scan.

### docs/shared-session-actions/REQUIREMENTS.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 63.

### docs/skill-commands/REQUIREMENTS.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 64.

### docs/sonar-remediation/DESIGN.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 65.

### docs/sonar-remediation/REQUIREMENTS.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 66.

### docs/sonar-remediation/REVIEW.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 67.
- [docs/sonar-remediation/REQUIREMENTS.md](../../docs/sonar-remediation/REQUIREMENTS.md), line 5.

### docs/steering/REQUIREMENTS.md

- [docs/backend-sdk/PROTOCOL.md](../../docs/backend-sdk/PROTOCOL.md), line 407.
- [docs/backend-sdk/REQUIREMENTS.md](../../docs/backend-sdk/REQUIREMENTS.md), line 8.
- [docs/backend-sdk/REQUIREMENTS.md](../../docs/backend-sdk/REQUIREMENTS.md), line 37.
- [docs/backend-sdk/REQUIREMENTS.md](../../docs/backend-sdk/REQUIREMENTS.md), line 84.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 68.

### docs/swift-test-ownership/DESIGN.md

- None found by this scan.

### docs/swift-test-ownership/REQUIREMENTS.md

- [docs/development.md](../../docs/development.md), line 77.
- [docs/swift-test-ownership/S2-VERIFICATION.md](../../docs/swift-test-ownership/S2-VERIFICATION.md), line 3.
- [docs/swift-test-ownership/S3-VERIFICATION.md](../../docs/swift-test-ownership/S3-VERIFICATION.md), line 3.

### docs/swift-test-ownership/S2-VERIFICATION.md

- [docs/swift-test-ownership/S3-VERIFICATION.md](../../docs/swift-test-ownership/S3-VERIFICATION.md), line 17.

### docs/swift-test-ownership/S3-VERIFICATION.md

- None found by this scan.

### docs/tagged-dependencies/DESIGN.md

- None found by this scan.

### docs/tagged-dependencies/REQUIREMENTS.md

- None found by this scan.

### docs/usage.md

- [README.md](../../README.md), line 30.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 69.

### docs/web-organization/REQUIREMENTS.md

- Retired in the first small migration; current guidance is in [Development](../../docs/development.md#frontend-organization). The locations below describe the original inventory baseline, not live dependencies.

- [docs/development.md](../../docs/development.md), line 101.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 70.

### docs/websocket-logging/REQUIREMENTS.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 71.

### docs/widget-colors/ANSI-PROBE.md

- [docs/widget-colors/DESIGN.md](../../docs/widget-colors/DESIGN.md), line 44.
- [docs/widget-colors/IMPLEMENTATION.md](../../docs/widget-colors/IMPLEMENTATION.md), line 58.

### docs/widget-colors/DESIGN.md

- None found by this scan.

### docs/widget-colors/IMPLEMENTATION.md

- None found by this scan.

### docs/widget-grid/DESIGN.md

- None found by this scan.

### docs/widget-links/DESIGN.md

- None found by this scan.

### docs/worktree-projects/REQUIREMENTS.md

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 72.
- [docs/project-archive-flow/REQUIREMENTS.md](../../docs/project-archive-flow/REQUIREMENTS.md), line 40.

### docs/images/pi-chat-commands.png

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 37.

### docs/images/pi-chat-home.png

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 38.

### docs/images/pi-chat-latex.png

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 39.

### docs/images/pi-chat-session-light.png

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 40.

### docs/images/pi-chat-session.png

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 41.

### docs/images/showcase/light.png

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 42.

### docs/images/showcase/manifest.json

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 43.

### docs/images/showcase/pi-chat-showcase.png

- [README.md](../../README.md), line 5.
- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 44.

### docs/images/showcase/projects.png

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 45.

### docs/images/showcase/quick-switcher.png

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 46.

### docs/images/showcase/workspace.png

- [docs/pi-server-extraction/INVENTORY.md](../../docs/pi-server-extraction/INVENTORY.md), line 47.

## Missing-target candidates

| Source | Line | Resolved target | Interpretation |
|---|---:|---|---|
| [docs/backend-sdk/REQUIREMENTS.md](../../docs/backend-sdk/REQUIREMENTS.md) | 87 | `packages/pi-sdk/README.md` | Historical reference to removed workspace/artifact. |
| [docs/backend-sdk/REQUIREMENTS.md](../../docs/backend-sdk/REQUIREMENTS.md) | 90 | `packages/pi-sdk/typescript/README.md` | Historical reference to removed workspace/artifact. |
| [docs/backend-sdk/V1-INVENTORY.md](../../docs/backend-sdk/V1-INVENTORY.md) | 5 | `packages/pi-sdk/README.md` | Historical reference to removed workspace/artifact. |
| [docs/pi-server-extraction/S4-CUTOVER.md](../../docs/pi-server-extraction/S4-CUTOVER.md) | 6 | `vendor/server-artifact.json` | Historical reference to removed workspace/artifact. |
| [docs/readme-showcase/CAPTURE.md](../../docs/readme-showcase/CAPTURE.md) | 44 | `docs/readme-showcase/docs/images/showcase/pi-chat-showcase.png` | Fenced README integration example; valid when copied to root README. |

## Machine-local absolute links

- These are nonportable references, not verified missing files. Do not follow them or modify other repositories as part of this cleanup.

- [docs/pi-server-extraction/HANDOVER.md](../../docs/pi-server-extraction/HANDOVER.md), line 9: `/Users/manuelselch/Documents/A_Personal/40%20Projekte/47%20Agents/Pi%20Agent/pi-sdk-typescript`.
- [docs/pi-server-extraction/HANDOVER.md](../../docs/pi-server-extraction/HANDOVER.md), line 10: `/Users/manuelselch/Documents/A_Personal/40%20Projekte/47%20Agents/Pi%20Agent/pi-sdk-swift`.
- [docs/pi-server-extraction/S3-EXTRACTION.md](../../docs/pi-server-extraction/S3-EXTRACTION.md), line 5: `/Users/manuelselch/Documents/A_Personal/40%20Projekte/47%20Agents/Pi%20Agent/pi-server`.
- [docs/pi-theme/S2-VERIFICATION.md](../../docs/pi-theme/S2-VERIFICATION.md), line 6: `/Users/manuelselch/Documents/A_Personal/40%20Projekte/47%20Agents/Pi%20Agent/pi-sdk-typescript`.
- [docs/pi-theme/S3-VERIFICATION.md](../../docs/pi-theme/S3-VERIFICATION.md), line 4: `/Users/manuelselch/Documents/A_Personal/40%20Projekte/47%20Agents/Pi%20Agent/pi-server`.
- [docs/pi-theme/S3-VERIFICATION.md](../../docs/pi-theme/S3-VERIFICATION.md), line 4: `/Users/manuelselch/Documents/A_Personal/40%20Projekte/47%20Agents/Pi%20Agent/pi-server/docs/pi-theme/S3-VERIFICATION.md`.

## Adjacent material retained outside this inventory

- [Existing session-inbox requirements](../session-inbox/REQUIREMENTS.md) and [design](../session-inbox/DESIGN.md): contain approved corrections and refinements; implementation commits are not proof of final acceptance. Leave unchanged.
- [Mockups](../../mockups/): preserve approved baselines; no asset/prototype deletion proposed here.
- [Testing guide](../../test/README.md), [vendor guide](../../vendor/README.md), [themes guide](../../themes/README.md), root [README](../../README.md), scripts and manifests: link consumers and reconciliation targets only. Their documentation links may need updating in an approved migration.
