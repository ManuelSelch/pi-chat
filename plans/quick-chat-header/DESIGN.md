# Quick Chat header — Design

## Overview
The inbox header currently renders the selected runtime's `projectName` directly. The catalogue already identifies the home-folder project with `quickChats: true`, but HeaderContainer only reads the catalogue to resolve its branch.

HeaderContainer will use that existing catalogue lookup to derive the header presentation: a marked Quick Chats project receives the singular breadcrumb `Quick Chat`; other projects retain their runtime project name. Pass the derived presentation to InboxHeader without mutating runtime inventory or SDK state.

## Decisions & Trade-offs
- Use the authoritative `quickChats` marker and exact project-path match, not a username, folder-name heuristic, or browser filesystem knowledge.
- Keep the change local to header presentation. No SDK/server changes, dependencies, navigation changes, or new abstractions.
- Preserve runtime names for ordinary projects and while catalogue discovery has not identified a Quick Chats project. A subsequent catalogue update naturally rerenders the header.
- Keep the existing plural `Quick Chats` label in the projects panel. The singular header follows the requested `Quick Chat` wording.
- This restores a label in the existing layout, so no new mockup is needed.

## Verification
- Proposed executable rendering scenarios: [quick-chat-header.dom.test.tsx](../../test/modules/web/app/shell/quick-chat-header.dom.test.tsx). They exercise the real HeaderContainer and InboxHeader with supplied application state, not a browser or live server. No new Driver or assertion semantics.
- Preserve existing header title/navigation and inbox action-eligibility tests in [session-title.dom.test.tsx](../../test/modules/web/app/shell/session-title.dom.test.tsx) and [inbox-header.dom.test.tsx](../../test/modules/web/sessions/inbox/ui/components/inbox-header.dom.test.tsx).
- Run focused DOM tests and TypeScript checking after approval.

## Open Questions
None.
