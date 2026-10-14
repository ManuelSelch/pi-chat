# Pi Chat Project Panel Recency — Requirements

## Goal
Make the project panel reflect session activity rather than alphabetical position. All unpinned projects with unarchived sessions belong in the recent list, without a five-project limit.

## Scope
### In Scope
- Unlimited recent projects and recency-based project ordering.
- Repository-level recency across primary checkouts and linked worktrees.
- Regression coverage for ordering, section membership, and archive/restore transitions.

### Out of Scope
- Changes to the existing panel layout, headings, or session-row design.
- New timestamps for opening sessions, server persistence changes, or catalogue redesign.
- Changes to session archive, pin, removal, or worktree discovery behavior.
- Unrelated steering and snapshot requirements in the root REQUIREMENTS.md, which remain unchanged.

## Requirements
- Quick Chats remains first and separate from repository groups.
- Pinned projects remain in their separate section, without duplication in recent or other projects.
- Every unpinned project with at least one unarchived session appears in the recent list. Remove the five-project limit entirely.
- Other projects contains only visible unpinned projects with no unarchived sessions. Retain its collapsed-by-default behavior.
- Order recent projects by their latest unarchived session modification timestamp, newest first. Archived sessions must not promote a recent project.
- Compute recency across all sessions in a repository group, including primary and linked worktree checkouts.
- Resolve equal timestamps deterministically by project name, then group key.
- Preserve existing session ordering within each project and current-project expansion behavior.
- Archiving the last unarchived session moves an unpinned project into Other projects; restoring a session returns it to the recent list in recency order.
- Keep project-history removal controls limited to Other projects under the updated membership rule.

## Assumptions
- Recency means session modification activity, using the existing session.modified field; merely opening an old session does not count as new activity.
- Pinned projects and Other projects retain alphabetical ordering; the recency change applies to the recent list.
- The existing catalogue refresh lifecycle supplies updated session timestamps; no additional refresh mechanism is needed.

## Implementation Plan
### 1. Model Project Recency
Description: Add a repository-group recency value derived from the maximum modification timestamp among its unarchived sessions. Keep pinned and archived-only group ordering unchanged. Order unpinned groups with unarchived sessions newest first, with deterministic name/key ties. Add pure-model tests covering alphabetical order conflicting with recency, archived-session exclusion, ties, and activity from linked worktrees.

### 2. Remove the Recent Project Limit
Description: Depends on slice 1. Replace the drawer's five-project slicing with all unpinned groups with unarchived sessions. Limit Other projects to groups with no unarchived sessions. Add DOM regressions with more than five active projects, including pi-chat outside the first five alphabetically, and verify Quick Chats, pins, current-project expansion, and removal-button placement.

### 3. Verify Archive and Restore Transitions
Description: Depends on slices 1–2. Add regressions for archiving the last unarchived session and restoring archived sessions, checking both membership and recency order after catalogue updates. Run focused model/drawer/archive tests, typechecking, and the production build; compare any full-suite failures with the baseline. Commit verified implementation changes without pushing.

## Open Questions
None.
