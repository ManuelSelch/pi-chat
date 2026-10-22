# Playwright CI Container — Design

## Approach
Run only the E2E GitHub Actions job in the official Playwright image. The confirmed bottleneck is APT downloading system dependencies from the Ubuntu Azure mirror, not downloading Chromium. A prebuilt image eliminates this per-run APT installation.

## Components & Data Flow
- **Changed:** `.github/workflows/tests.yml`, E2E job only.
- **Reused:** Node 24 setup, npm installation with lifecycle scripts disabled, harness compilation, downloaded build artifacts, coverage runner and artifact uploads.
- **Unchanged:** build, unit and Sonar jobs; application and tests.

## Key Implementation Details
Use `mcr.microsoft.com/playwright:v1.63.0-noble`, matching Playwright 1.63.0 in `package-lock.json`. The tag is present in Microsoft's registry tag listing. Use `--ipc=host` for Chromium shared memory and explicitly retain Bash for run steps, since job containers otherwise default to sh.

Remove the `Install Playwright Chromium` step entirely. The image provides browsers and Linux dependencies; `npm ci --ignore-scripts` still provides the project's Playwright test package. Keep Node 24 through setup-node rather than depending on the image's bundled Node version. Add a nearby comment requiring the image version to track the lockfile on Playwright upgrades.

## Complexity Guardrails
No custom Dockerfile, browser cache, new dependencies, application changes or unrelated workflow refactoring.

## Verification
Check workflow syntax and diff; verify the image version matches all locked Playwright packages. Where Docker is available, smoke-test Chromium launch inside the image. Full integration verification requires the next GitHub Actions run; do not claim hosted CI has passed before that run completes.

## Decisions for Approval
Approved by the user. No additional scope or dependency upgrades.

## Verification Results
- Passed YAML parsing and structural assertions for image/lockfile version alignment, IPC, Bash, retained Node 24, preserved E2E steps and unchanged build/unit/Sonar jobs.
- Confirmed the official image tag exists in Microsoft's registry; `git diff --check` passed.
- Container smoke test unavailable: the local Docker daemon is not running. Hosted integration verification remains pending the next GitHub Actions run.
