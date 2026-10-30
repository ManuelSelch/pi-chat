# Settings grouping and endpoint field — Design

## Overview
Implement approved [mockup revision 6](../../mockups/settings-features/DESIGN.md) in the existing settings components. Group Session first, Feature Toggles next, optional Extensions next, and Backend server last; do not add state owners or change server/SDK contracts.

## Decisions & Trade-offs
- SettingsDrawer owns the grouped panel layout: one Session panel for advertised Thinking, Model and Compact session controls; retain individual availability/option-count/busy rules. Do not render an empty Session group at Home. Keep feature-driven titles, values, callbacks and action labels.
- Compact transcript becomes the fifth Feature Toggles switch: checked selects `compact`, unchecked `comfortable`. Preserve the browser-local `pi-chat:transcriptDensity` key and rendering, but change the fresh default: before `comfortable` → after `compact`. Explicitly stored choices are honored. Session compaction remains a distinct action.
- SettingsDrawer's final Backend server panel wraps the existing serverSettings content plus the advertised restart action, preserving the app-feature fallback at Home. ServerSettingsPanel becomes content without its own nested Panel. Its heading and status share one row; Save/Reset use equal-width buttons across a full-width row.
- Remove the separate Transcript panel, duplicate Current endpoint label/value, both routine backend helper descriptions, the archived-session description, and the compaction description. Keep connection errors, validation, origin restrictions, storage warnings/errors and existing confirmation dialogs. Keep optional extension controls before Backend server.
- useServerSettings initializes the draft from the effective `preference.endpoint`, not the possibly empty override. Compare `(trimmed draft || defaultEndpoint(page))` with the effective endpoint to avoid redundant saves, so an unchanged prefilled endpoint keeps Save disabled. A blank draft still selects the default; a distinct stored override is still cleared and persisted by Reset or a blank save. No storage migration.
- The endpoint input contains the full editable URL, including query parameters, as saved overrides already did; unlike the removed read-only display it is not redacted. Do not put the URL in logs/error messages. Redacting an editable value could accidentally save a truncated URL. This exposes a default URL's query in the input too, an intentional presentation change.
- Supersede the separate-Transcript, retained archive-description and comfortable-default decisions in [header-settings](../header-settings/DESIGN.md); preserve its remaining scope. No dependency changes.

## Verification
- [SettingsDrawer DOM scenarios](../../test/modules/web/settings/settings-drawer.dom.test.tsx): five toggles, both density mappings/callbacks, group order with extension controls, session/restart callbacks, Home availability, busy session controls, unavailable chimes, description removal; existing extension/archive scenarios remain.
- [Preference-hook scenario](../../test/modules/web/settings/preferences/use-transcript-density.dom.test.tsx): fresh browser defaults to `compact`; a stored `comfortable` is honored and persisted.
- [Endpoint hook scenarios](../../test/modules/web/settings/server/app/use-server-settings.dom.test.tsx): prefilled default/custom/query, unchanged and blank-default save gating. Preserve confirmed persistence-before-reload, cancellation, invalid input, storage failure, reset-invalid-draft and blank-removes-override contracts. The storage-failure fixture now edits to a genuinely different endpoint and the blank-override fixture stores a distinct endpoint; asserted outcomes are unchanged.
- [Server panel DOM scenario](../../test/modules/web/settings/server/ui/server-settings-panel.dom.test.tsx): editable URL and status without duplicate endpoint/helper text. Preserve disconnected recovery, disabled actions, validation and storage/origin errors.
- These tests use real components/hooks with callback spies, not a backend or real reload. No Driver changes or throwing scaffolds. DOM assertions do not verify equal-width geometry or badge placement; offer implemented screenshots at desktop/mobile with permission.
- Results: `test/modules/web/settings` passes 78/78 and `npx tsc --noEmit` passes. Full-suite/e2e and browser screenshots are not run.

## Open Questions
None.
