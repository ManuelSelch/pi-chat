# Quick Switcher — Requirements

## Goal
Provide a fast, keyboard-first command-palette experience for finding and opening Pi Chat folders, worktrees, and sessions. Lightweight query scopes and unmistakable result-type icons make results easier to narrow and distinguish.

## Scope
### In Scope
- Quick switcher overlay opened from the existing application shell.
- Search across folders/projects, worktrees, and sessions.
- Optional `#` project/folder, `%` worktree, `@` session, and `/` action query scopes with clickable scope controls.
- Distinct type icons with accessible type descriptions; no visible right-hand type labels.
- Built-in New session, Open folder…, and Open settings actions through existing callbacks.
- Keyboard navigation and activation.

### Out of Scope
- General command/action registry, arbitrary executable commands, or automatic execution of extension slash commands.
- Creating folders/worktrees or managing their lifecycle.
- Changes to the projects panel's existing layout or filtering behavior.
- Recency-based ranking beyond what is needed to provide predictable fuzzy-search results.
- Blue selected/active background styling for the current tab or project; only a subtle hover effect is in scope.

## Requirements
- The switcher is opened and dismissed without disrupting the current session. Preserve the existing Cmd+O shortcut and make it available on the home screen too, including when no session is open.
- Unscoped text searches supported folder/project, worktree, session, and available built-in action entries together. Preserve recent sessions for the empty unscoped query.
- `#`, `%`, `@`, and `/` at the beginning of the query restrict results to folders/projects, worktrees, sessions, and actions respectively. Scope prefixes are optional; an empty scoped query lists that type. Unknown prefixes are treated as ordinary search text.
- Matching is fuzzy across the searchable metadata for the selected scope, or across all supported types when unscoped. Stronger name/title matches rank ahead of weaker path/context matches; ties have deterministic ordering.
- Search matches relevant displayed metadata: folder/project name and path, worktree name/branch and parent project, and session title plus its associated folder/worktree metadata where available.
- Every result displays a type-appropriate icon and an accessible row name containing its type. Do not show visible right-hand Session / Worktree / Folder / Action labels (approved mockup revision 3).
- Scope controls expose All, # Folders, % Worktrees, @ Sessions, and / Actions; clicking a scope resets the query to its prefix and focuses search. Active scope uses neutral underlined text.
- Available New session, Open folder…, and Open settings results invoke existing application callbacks, not a new execution framework.
- Worktree results identify their branch and parent project when available. Folder results show a disambiguating path when needed. Session results identify the associated project/worktree when available.
- Results are keyboard navigable, Enter opens the highlighted result, and Escape closes the switcher. Fuzzy relevance determines ranking, with deterministic tie-breaking.
- Opening a folder/worktree follows existing project/session opening behavior; selecting a session resumes that session.
- Empty states distinguish no matches from an empty catalogue, and the user can edit or clear the query without closing the switcher.
- Search, scope parsing, fuzzy relevance, and deterministic tie-breaking are unit tested; UI tests cover type presentation, keyboard selection, activation, empty states, and compatibility with existing navigation.
- Current-tab and current-project states do not use blue background highlighting. Rows use a subtle neutral hover effect; keyboard result selection uses a thin neutral border without a filled background. Open-session status is plain muted text, not a blue badge.

## Assumptions
- The current project/session catalogue contains sufficient metadata to distinguish folders, worktrees, and sessions; gaps will be confirmed during implementation.
- Prefix syntax is `#` for folders/projects, `%` for worktrees, and `@` for sessions, as proposed in the discussion.
- The existing Cmd+O shortcut already opens the quick switcher.
- Only three built-in UI actions are included; arbitrary application/extension commands remain out of scope.

## Implementation Plan
### 1. Catalogue and Search Model
Description: Inspect existing quickswitcher and catalogue behavior, define typed results and scope parsing, and implement deterministic scoped/unscoped matching over available metadata. Verify parsing, filtering, metadata matching, and ordering with focused unit tests.

### 2. Palette UI and Result Identity
Description: Refine the existing keyboard-accessible overlay to match approved mockup revision 3: distinct icons and accessible type descriptions without visible type labels, contextual path/branch/project metadata, neutral hover and keyboard selection, and clickable scopes. Extend the slice-1 search model with / actions and wire the three built-in actions through existing callbacks. Verify accessible names, scope controls, action callbacks, and correct type presentation for each result kind.

### 3. Navigation, Activation, and Empty States
Description: Preserve Cmd+O in session views and enable it on the home screen, including when no session is open. Wire query editing, arrow-key selection, Enter activation, Escape dismissal, and existing folder/worktree/session opening flows. Provide catalogue-empty and no-match states; verify shortcut access from both home and session views through UI tests and the existing test/build checks.

## Open Questions
None.
