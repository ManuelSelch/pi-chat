# Worktrees in the projects panel

Status: implemented.
Scope: repository-aware grouping in the Projects and sessions drawer.

Implementation summary: Git worktree discovery enriches the existing catalogue with repository and checkout metadata, including registered zero-session worktrees. The drawer groups multiple checkouts under a repository row while preserving checkout-specific sessions and actions. The path-display preference now controls the selected checkout path in the session panel; nested checkout rows show branch/status information without path descriptions.

Verification: 54 test files / 406 tests pass, TypeScript and production build pass, and `git diff --check` passes.

## Problem and goals

The `/worktree` extension creates linked Git checkouts under `~/.worktrees/<repo>/<branch-folder>/`. Pi Chat currently infers projects from session working directories and displays each directory as an unrelated project. This separates related work and makes branch folders difficult to recognize.

Group related checkouts beneath their repository while preserving checkout-specific sessions and session creation. Use Git repository identity, not matching project names or a required directory layout.

The user explicitly requested that paths use the existing path-display setting. Do not add full-path hover tooltips.

## Terminology

- **Repository group:** related checkouts sharing the same Git common directory.
- **Primary checkout:** the repository's main working tree; its branch need not be named `main`.
- **Linked worktree:** an additional checkout registered with Git.
- **Checkout row:** a selectable working directory whose sessions appear on the right.
- **Known directory:** a working directory from recent sessions or the active session.

## Functional requirements

### 1. Identify related checkouts

1. Resolve repository identity on the server using the canonical Git common-directory path. A suitable source is `git rev-parse --git-common-dir`, resolving relative output against the command's working directory.
2. Discover registered checkouts and branch information using Git worktree metadata, such as `git worktree list --porcelain`.
3. Support worktrees both inside and outside `~/.worktrees/`; the extension's naming convention is not an identity source.
4. Never merge unrelated repositories because they share a folder name, branch name, or remote URL.
5. Normalize filesystem aliases for repository/checkout matching where resolvable. Preserve usable working-directory paths for session actions.
6. Existing session working-directory grouping remains authoritative. Do not silently move sessions from a repository subdirectory to its checkout root or aggregate those sessions into root-checkout sessions. Subdirectory entries may remain standalone in this first version.

### 2. Discover worktrees without sessions

1. Starting from known directories, discover their repositories' registered worktrees, including the primary checkout.
2. Include registered checkouts with zero sessions so users can select them and start a session directly.
3. If the only known directory is a linked worktree, still discover and show its repository group and primary checkout.
4. Do not scan every repository on disk or recursively scan `~/.worktrees/`.
5. Refresh discovery when the catalogue is refreshed. Worktrees created or removed externally must be reflected on the next normal catalogue refresh; filesystem watching is not required.

### 3. Render repository groups

For repositories with linked worktrees, render a collapsible repository row with indented checkout rows:

```text
▾ pi-chat                            12
    main                              8
    ⑂ feat-worktree-projects-panel     3  current
    ⑂ fix-reconnect                   1
▸ blueflow                            6
```

The symbols illustrate hierarchy; actual icons follow the existing UI conventions.

1. Use the primary checkout's project name as the repository label; if unavailable, use a stable readable fallback derived from repository metadata.
2. Label checkout rows by branch, without `refs/heads/`.
3. Visually distinguish linked worktrees from the primary checkout. Identify the primary checkout even when its branch is not `main`.
4. For detached HEAD, show a readable detached label with an abbreviated revision when available. If branch metadata cannot be read, use the checkout folder name.
5. The repository row controls expansion only. It does not select an aggregate session list or provide an ambiguous session-creation target.
6. Checkout rows remain independently selectable. Their selection highlight follows the browsed checkout, not necessarily the running session.
7. A repository with only its primary checkout keeps the existing single selectable project row. Non-Git directories also keep the existing presentation.
8. Show checkout session counts, including zero. The repository count is the sum of its displayed checkout counts, without duplicate sessions.
9. Show the existing `current` indicator on the checkout matching the active session's working directory. When collapsed, indicate that the group contains the current checkout.

### 4. Paths and display preference

1. Reuse the existing path-display setting and existing display-path formatting.
2. When enabled, the selected checkout's session panel shows its checkout display path using the existing formatting. This applies to ordinary projects as well as worktrees.
3. Nested checkout rows show the branch/worktree label and status only; they do not show a path description.
4. When disabled, do not show the session-panel path.
5. Do not add full-path hover tooltips or `title` attributes as an alternative path-display mechanism.
6. Do not add a new preference or change the existing preference's storage key/default.

### 5. Selection, expansion, and ordering

1. Selecting a checkout shows only that directory's sessions in the right-hand pane, newest first as today.
2. `New session` uses the selected checkout's actual working directory. Opening and deleting sessions retain their current behavior and busy-session safeguards.
3. A zero-session checkout shows an empty-session state and allows `New session` when available.
4. Opening the drawer reveals the active checkout by expanding its repository. Revealing an active checkout after a session switch must not repeatedly override a user's collapse action on unrelated snapshot refreshes.
5. Preserve browsed selection and expansion through ordinary catalogue updates while their targets still exist. Persistent expansion storage across browser reloads is not required.
6. Sort groups and standalone rows by most recent contained session activity. Within groups, show the primary checkout first, then linked worktrees by most recent session activity.
7. Worktrees without sessions follow those with sessions; use a stable alphabetical label/path tie-breaker. Discovery must not assign a fresh activity timestamp merely because a worktree was found.
8. If the selected entry disappears, fall back to the active checkout if present, then the first available checkout/project. Do not keep showing sessions for a stale selection.

### 6. Missing directories and degraded discovery

1. Keep missing checkout directories with session history visible but disabled, retaining their sessions and existing missing-folder presentation.
2. Use registered Git metadata to associate missing checkouts where possible. If their repository relationship cannot be established, leave them standalone rather than guess by name.
3. Removed, unregistered worktrees with no session history disappear on refresh.
4. A stale registered worktree whose directory is missing may remain visible but disabled, including with zero sessions.
5. Missing Git, non-Git directories, permissions errors, invalid metadata, or failed Git commands must not break the catalogue or hide unrelated projects. Fall back to the current flat directory presentation for affected entries when necessary.
6. Discovery is read-only: do not create, prune, repair, remove, or switch worktrees/branches.

## Non-functional requirements

- The server owns repository metadata; the browser receives typed catalogue data and does not run Git or infer identity from path names.
- Preserve existing catalogue consumers, especially Home and Quick Open. Registered zero-session checkouts must not produce fake session search results.
- Deduplicate Git discovery per repository within a catalogue refresh. Avoid blocking synchronous Git calls and unbounded subprocess concurrency; bound command execution time and output.
- Execute Git with argument arrays, never shell interpolation of paths or branch names.
- Use accessible keyboard-operable expansion/selection controls with expansion state exposed to assistive technology. Do not conflate expand and checkout-selection actions.
- Preserve existing scrolling, drawer layout, open-folder action, session deletion confirmation, and path preference behavior.

## Incremental implementation plan

1. **Add read-only repository discovery.** Introduce a small server-owned discovery boundary and tests using temporary Git repositories. Cover common-directory identity, primary/linked checkouts, detached HEAD, and failure fallback.
2. **Enrich the catalogue.** Add typed repository/checkout metadata to server and shared protocol types. Merge registered zero-session checkouts without changing directory-scoped session ownership. Test deduplication, missing paths, sorting, counts, and discovery from a linked worktree alone.
3. **Render grouped checkout navigation.** Update `src/web/sessions/projects/ProjectSessionDrawer.tsx` and local helpers. Implement expansion, selection, labels, counts, current indicators, and existing-setting-controlled path descriptions.
4. **Verify interactions and regressions.** Add drawer DOM coverage and catalogue-consumer regression tests. Run the full suite, TypeScript, build, whitespace checks, and a browser smoke test with primary/linked checkouts.

Each step should be independently reviewable. No worktree-management UI is needed.

## Acceptance scenarios

- Primary checkout plus two worktrees appear as one expandable repository group, with separate session lists and correct counts.
- Two unrelated repositories named `pi-chat` remain separate groups.
- A worktree outside `~/.worktrees/` groups correctly; a same-named ordinary directory inside it is not grouped by name alone.
- A catalogue containing sessions only in a linked worktree still exposes its primary checkout and registered zero-session siblings.
- Selecting a zero-session sibling and clicking `New session` starts in that sibling's directory.
- Changing the path-display setting shows/hides descriptions, with no path tooltip in either mode.
- A detached worktree is selectable and has a meaningful label.
- Missing checkouts with history remain visible and disabled; removed worktrees without history disappear after refresh.
- Non-Git projects, Git discovery failures, and repositories without linked worktrees retain usable flat navigation.
- Refresh preserves valid selection/expansion; drawer opening reveals the current checkout; expanding a group does not start or switch a session.
- Home, Quick Open, session opening/deletion, and busy-session safeguards still work.

## Scope limits and assumptions

- This is a presentation/discovery feature, not integration with the `/worktree` extension API. Git metadata is sufficient and works with worktrees created by any tool.
- No create/merge/remove worktree buttons, branch switching, dirty-state badges, remote grouping, full-path tooltips, or new settings.
- Repository groups do not combine sessions across checkouts.
- Discovery is seeded by session-known directories; repositories with no known sessions and no active session remain outside this catalogue.
- No product decisions remain open for the initial scope. Exact icons and unavailable-metadata fallback wording can follow existing UI conventions.
