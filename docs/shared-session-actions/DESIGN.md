# Settings Command Label — Design

## Overview
Rename the shared action label from “Open settings” to “Settings”. Keep execution and availability unchanged.

## Components
| Package/module | Component | Change | Responsibility |
|---|---|---|---|
| Web sessions | [buildSessionActions](../../src/web/sessions/actions/session-actions.ts) | Changed | Supply the shared Settings label to both menus |
| Tests | Shared menu and quick-open coverage | Changed | Expect the renamed label and verify settings still opens |

Existing overlay operations retain ownership of settings visibility; no state changes are introduced.

## Runtime flow
1. A command menu reads the shared session actions.
2. The user selects Settings.
3. The existing openSettings callback opens the settings overlay.

## Contracts & API changes
| Provider → consumer | Current → proposed contract | Compatibility |
|---|---|---|
| Shared actions → menus | Open settings → Settings display name | Label-only change; settings identifier and callback unchanged |

## Decisions & Trade-offs
- Change the shared label rather than special-casing individual menus.
- Update relevant test fixtures and expectations. Leave historical mockups and requirements intact.
- No dependency, protocol or execution changes.

## Verification
Run focused session-action and quick-open tests; update the end-to-end menu expectation to Settings. Verify the existing callback assertion still passes.

## Open Questions
None.
