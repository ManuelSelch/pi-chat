# Header and settings cleanup — Design

## Overview
Keep the existing shell and settings architecture. Remove the static top-left branding from [InboxHeader](../../src/web/sessions/inbox/ui/components/InboxHeader.tsx), change the browser preference default in [usePiChat](../../src/web/app/use-pi-chat.ts), and consolidate switches in [SettingsDrawer](../../src/web/settings/SettingsDrawer.tsx).

## Decisions & Trade-offs
- Remove only the header’s “Pi Chat” text. Preserve project/session breadcrumbs, navigation and session actions. The centered Home title is outside scope.
- Change the `pi-chat:session-inbox` fallback from false to true. Continue honoring explicitly stored true/false using the existing Mantine local-storage hook; do not reset preferences or introduce a migration. State ownership and browser-local lifetime remain unchanged.
- Put the four existing switches (sidebar sessions, chimes, folder paths, archived visibility) in one Panel named “Feature Toggles”, exposed as an accessible group. Use the existing settings callbacks and consistent spacing. Keep Transcript’s segmented control and all server/session/extension controls separate and unchanged. Retain the chime availability restriction and archived-session description.
- While the selected session status is running, do not render the header’s Move to Later (pause icon) or Archive buttons; currently they remain visible but disabled. Restore them on completion using the existing eligibility checks. Keep Close view available and blocked/unsaved behavior unchanged. Sidebar rows already omit these actions while running; preserve that behavior.
- No dependency, server, SDK or protocol changes. No separate mockup: this is a local label/grouping cleanup, not a new feature or material shell redesign.
- Existing tabs/projects browser scenarios must retain their legacy-mode journeys. During implementation, explicitly opt those fixtures into tabs mode where needed rather than weakening assertions. Fresh-default coverage must not inherit that opt-out.

## Verification
- [Browser scenarios](../../test/e2e/header-settings.spec.ts) cover fresh defaults, unbranded headers at Home and in-session, explicit preferences across reloads, and idle → running → idle action visibility (including preserved sidebar hiding).
- [Settings DOM scenarios](../../test/modules/web/settings/settings-drawer.dom.test.tsx) cover group membership and preserved settings/extension behavior.
- Existing [Inbox scenarios](../../test/e2e/session-inbox.spec.ts) preserve mode toggling, drafts, responsive navigation and lifecycle contracts.
- New browser assertions are explicitly throwing test-only scaffolds pending approval; no behavioral verification has run. Dependencies are not installed in this worktree.
- Implement the new assertions after approval, run focused DOM/browser regressions and build/type checks, then offer optional implemented-UI screenshot review with permission.

## Open Questions
None. “Default” is interpreted as applying when no explicit browser preference exists, not overriding an existing opt-out.
