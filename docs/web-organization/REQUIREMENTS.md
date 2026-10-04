# Frontend grouping plan

Status: implemented; all seven steps are complete.
Scope: `src/web/` in the current checkout.

## Completed scope

Implemented step 5 first at the user's request:

- Grouped transcript, Markdown, and tools under `chat/transcript/`, `chat/markdown/`, and `chat/tools/`.
- Moved auto-scroll into transcript and command-menu files into `chat/composer/`.
- Moved/renamed FooterContainer and FooterView to ComposerContainer and ComposerView; updated App and test imports.
- At completion of step 5, application state/transport and runtime footer/widgets were left for steps 2 and 4. Application services have since moved in step 2; runtime footer/widgets still await step 4. No compatibility shims were introduced.
- Fixed three pre-existing DOM test failures by awaiting lazy Markdown rendering. No production behavior changed.

Verification: all 49 test files / 390 tests pass, TypeScript and production build pass, and whitespace checks pass. All 14 relocated modules were compared with the originals: only import paths and Composer naming changed. The production CSS, Markdown, and main bundle hashes match the baseline. No browser smoke was run for this move-only step.

Implemented step 1 next at the user's request:

- Moved theme tokens to `ui/theme.ts`, shared dialog actions to `ui/DialogActions.tsx`, and generic confirmation modules to `ui/confirm/`.
- Updated all source and test imports; feature-specific close/rename dialogs remain in `dialogs/`.
- Verified every relative dependency in `ui/` stays within `ui/`; no feature or controller imports remain.
- All source/test changes are file moves and import-path updates only. No compatibility copies or behavior changes.

Verification: all 49 test files / 390 tests pass, TypeScript and production build pass, and whitespace checks pass. Production CSS, Markdown, and main bundle hashes match the baseline. No browser smoke was run for this move-only step.

Implemented step 2 using the clearer naming discussed with the user:

- Moved `use-pi-chat.ts` and `AppControllerContext.tsx` directly into `app/`: the hook coordinates state and communication, so it is not labeled as a pure connection module.
- Moved both reducers into `app/state/` and folder request correlation into `app/connection/`.
- Moved overlay coordination into `app/overlays/` and global keyboard routing/intent helpers into `app/keyboard/`.
- Removed the empty top-level `state/`, `overlays/`, and `shortcuts/` directories; updated source/test imports without compatibility shims.
- Verified application services no longer import projects or other presentation features. Existing public names and implementations are unchanged.

Verification: all 49 test files / 390 tests pass, TypeScript and production build pass, and whitespace checks pass. All source/test changes are file moves and import-path updates only. Production CSS, Markdown, and main bundle hashes match the baseline. No browser smoke was run for this move-only step.

Implemented step 3 at the user's request:

- Grouped Home, project/session browsing, folder selection, quick-open, tabs, and close/rename dialogs under `sessions/`, using the planned subfolders.
- Kept Home's search/ranking shared with QuickOpen and SessionRow's CSS module alongside its component.
- Updated App, header, Dialogs, and test imports. `dialogs/Dialogs.tsx` still aggregates runtime prompts and session dialogs until step 7.
- Removed the empty top-level `home/`, `projects/`, `quickopen/`, and `tabs/` directories. All 13 file moves and consumer/test updates preserve implementation apart from import paths.

Verification: all 49 test files / 390 tests pass, TypeScript and production build pass, and whitespace checks pass. Existing tests cover Home/session selection, folder browsing/creation, quick-open ranking/mouse interaction, project session browsing, and optimistic tab state. Production CSS, Markdown, and main bundle hashes match the baseline. No browser smoke was run for this move-only step.

Implemented step 6 at the user's request, retaining `preferences/`:

- Moved chime playback/transition helpers, the chime hook, and the path-display hook into `settings/preferences/`.
- Updated settings, project browser, and test imports; no compatibility copies remain in `app/`.
- Preserved local-storage keys, defaults, audio preview/unlock behavior, background-tab transition handling, and hook cleanup.
- App composition is unchanged: SettingsContainer remains mounted while its drawer is closed, so chime playback remains active.

Verification: all 49 test files / 390 tests pass, TypeScript and production build pass, and whitespace checks pass. Source/test changes are file moves and import-path updates only. Production CSS, Markdown, and main bundle hashes match the baseline. No browser smoke was run for this move-only step.

Implemented step 4's move-only stage:

- Moved runtime prompts into `extensions/prompts/`, the widget module into `extensions/widgets/`, and runtime footer metadata into `extensions/footer/RuntimeFooter.tsx`.
- Renamed Footer's public component to RuntimeFooter and updated source/test imports without compatibility shims.
- Preserved prompt focus, responsive widget placement, footer order, and component mount behavior. Widget rendering/docking/placement are still together until the next stage.

Verification: all 49 test files / 390 tests pass, TypeScript and production build pass, and whitespace checks pass. Production CSS, Markdown, and main bundle hashes match the baseline. No browser smoke was run for this move-only stage.

Completed step 4's widget split in a separate stage:

- `WidgetPanel.tsx` owns widget rendering; WidgetBlock is exported only for reuse by the local dock module.
- `WidgetDock.tsx` owns docking JSX/geometry. The current header offset and width constants are retained; shell-offset parameterization remains an optional follow-up.
- `widget-placement.ts` owns the pure placement algorithm and responsive breakpoint; App and composer import it directly.
- Updated tests to target the new modules and added coverage for independent dock collapse/expand and non-mutating placement order.
- Verified extension presentation only depends on other extension modules, shared UI, and shared protocol types. Rendering, placement algorithm, and dock geometry match their pre-extraction implementations.

Verification: all 49 test files / 392 tests pass, TypeScript and production build pass, and whitespace checks pass. No browser smoke was run for this extraction; DOM tests cover rendering, collapse/expand, dock layout, and wide/narrow placement policy.

Completed step 7's app composition:

- Moved the header container/view into `app/shell/`, retaining their APIs and behavior.
- Replaced `dialogs/Dialogs.tsx` with `app/overlays/AppOverlays.tsx`, assembling runtime prompts, close/rename dialogs, quick-open, projects, folders, and settings in their original relative order.
- Kept provider nesting, global keyboard routing, composer mounting, Home/transcript selection, measured spacing, and widget docking unchanged. Settings remains mounted while closed so its chime hook stays active.
- Removed the legacy header/dialogs directories; the only top-level owners are now `app`, `chat`, `sessions`, `settings`, `extensions`, and `ui`. The entry point and lazy Markdown loading are unchanged.
- Added composition tests for overlay order, persistent settings mounting, and prompt/session action wiring. Documented the owners and dependency boundaries in the README.

Verification: all 50 test files / 395 tests pass, TypeScript and production build pass, and whitespace checks pass. Relative-import boundary inspection, including type-only imports, found no violations. Managed Chromium smoke against an isolated fake-runtime production server verified Home/new-session navigation, folder selection from Projects, independent tab drafts, quick-open and Escape dismissal, settings, runtime confirmation, composer suggestions, transcript rendering, wide dock/narrow inline widgets (390px iframe), reload, and take-control between browser tabs. Busy-run abort, long-transcript autoscroll, and app restart confirmations were covered by existing automated tests rather than this browser smoke.

## Problem and goals

The component extraction is useful: `App.tsx` is only 83 lines and containers generally isolate controller access from presentation. Do not undo that work by merging components.

The next cleanup should make ownership easier to discover. Today folders mix three organizing schemes: screen regions (`header`, `footer`), UI mechanisms (`dialogs`, `overlays`, `state`), and features (`projects`, `settings`). Related code is spread across them:

- Composer input, command suggestions, footer metadata, and extension widgets cross `footer/`, `commands/`, and `chat/`. `Footer` also means two different things.
- Session navigation crosses `home/`, `projects/`, `quickopen/`, `tabs/`, and session-specific dialogs.
- Application transport/state lives in `chat/`, with context in `state/` and request correlation in `projects/`. `use-pi-chat.ts` therefore imports a UI feature folder.
- Features import preferences and behavior helpers from `app/`, while `app/` composes those features.
- `chat/WidgetPanel.tsx` contains extension rendering, placement policy, and shell geometry.

Goals: six clear top-level owners, explicit dependency direction, recognizable file names, unchanged user behavior, and incremental moves that are easy to review.

Non-goals: new state libraries, transport redesign, SDK/server changes, universal component abstractions, merging small components, or a general-purpose plugin framework.

## Proposed layout

```text
src/web/
  app/
    main.tsx
    App.tsx
    styles.css
    AppControllerContext.tsx
    use-pi-chat.ts
    state/
      app-state.ts
      chat-state.ts
    connection/
      folder-requests.ts
    shell/
      HeaderContainer.tsx
      HeaderView.tsx
    overlays/
      OverlayController.tsx
      AppOverlays.tsx
    keyboard/
      GlobalKeyboardController.tsx
      shortcuts.ts
  chat/
    transcript/
      MessageList.tsx
      MessageListContainer.tsx
      ThinkingPanel.tsx
      use-auto-scroll.ts
    markdown/
      Markdown.tsx
      MarkdownLazy.tsx
      remark-display-math.ts
    tools/
      ToolCard.tsx
      EditDiff.tsx
      WriteContent.tsx
    composer/
      ComposerContainer.tsx
      ComposerView.tsx
      CommandMenu.tsx
      command-menu.ts
  sessions/
    home/
      Home.tsx
    projects/
      ProjectSessionContainer.tsx
      ProjectSessionDrawer.tsx
      SessionRow.tsx
      SessionRow.module.css
    folders/
      FolderPicker.tsx
      FolderPickerContainer.tsx
    quick-open/
      QuickOpen.tsx
      QuickOpenContainer.tsx
      quick-open.ts
    tabs/
      TabBar.tsx
    dialogs/
      CloseSessionDialog.tsx
      RenameSessionDialog.tsx
  settings/
    SettingsContainer.tsx
    SettingsDrawer.tsx
    preferences/
      chime.ts
      use-chimes.ts
      use-display-path.ts
  extensions/
    Slot.tsx
    widgets/
      WidgetPanel.tsx
      WidgetDock.tsx
      widget-placement.ts
    footer/
      RuntimeFooter.tsx
    prompts/
      PromptModal.tsx
      use-prompt-focus.ts
  ui/
    theme.ts
    Notice.tsx
    Panel.tsx
    SectionHeader.tsx
    StatusBadge.tsx
    DialogActions.tsx
    confirm/
      ConfirmDialog.tsx
      ConfirmDialogProvider.tsx
      confirm-enter.ts
```

These are responsibility groups, not mandatory architectural layers. Avoid adding `components/`, `hooks/`, `utils/`, or `index.ts` folders just to classify file types. Containers and views remain adjacent. Add a subfolder only for a cohesive group, not for every component.

### Ownership decisions

**App:** owns startup, composition, application state, server communication, overlay coordination, and global keyboard routing. Keep both reducers together in `app/state/`: `ChatState` is a session projection containing settings, prompts, widgets, and transcript data, not just chat UI state. Keep hook/context directly in `app/`, because the hook coordinates both state and communication. `app/connection/` contains request correlation; it does not imply that the WebSocket lifecycle has been extracted from the hook. The initially proposed `app/controller/` folder was dropped because its name obscured these responsibilities. Keep existing names and exports; renaming `ChatState` or `AppControllerContext` is not necessary for grouping.

**Chat:** owns reading/writing a conversation. Rename `FooterContainer`/`FooterView` to `ComposerContainer`/`ComposerView`; they own drafts, submission, suggestions, and composer measurement. `use-auto-scroll` belongs to the transcript, its actual consumer. Markdown is shared by transcript/tool rendering within chat; do not move it to generic `ui/` yet.

**Sessions:** owns selecting, creating, resuming, closing, renaming, and deleting sessions, including the Home entry screen. Keep quick-open ranking shared between Home and QuickOpen within this owner. Folder UI belongs here; correlated requests belong to the controller. Settings and composer may invoke session actions without importing session containers.

**Settings:** owns persistent browser preferences and their controls. Move chime and path-display helpers here. Preserve the existing lifetime of `useChimes`: `SettingsContainer` is mounted even when its drawer is closed. Do not accidentally mount notification playback only while the drawer is visible.

**Extensions:** owns protocol-driven extension presentation: slots, widgets, runtime footer metadata, and runtime UI prompts. `PromptModal` represents server/extension `ctx.ui` interaction, not an ordinary application confirmation. Rename `chat/Footer.tsx` to `RuntimeFooter.tsx` so it cannot be confused with the composer. Its entries include core runtime model metadata as well as extension labels; this group is for runtime contributions, not exclusively external plugins.

**UI:** owns application-independent primitives and generic confirmation. `DialogActions` is already used by feature dialogs and the project drawer, so move it here. Move the shared theme tokens here too. Do not move business-specific dialogs into `ui/` just because they use Mantine Modal.

## Dependency requirements

1. Application services (`app/use-pi-chat.ts`, `app/AppControllerContext.tsx`, `app/state/`, and `app/connection/`) may import shared protocol/directory types and other application services, but no presentation features or app composition/overlay/keyboard components. Moving `folder-requests.ts` removes the hook's dependency on `projects/`.
2. `ui/` must not import application context or feature modules. Generic confirmation is allowed to depend on other `ui/` files.
3. Feature containers may import `app/AppControllerContext.tsx`, `app/state/`, and `app/overlays/OverlayController.tsx`. Feature views should retain their existing prop-driven APIs; type-only state imports are allowed, but do not introduce controller access into views merely to shorten props.
4. Feature modules must not import `App.tsx`, shell components, or `AppOverlays.tsx`. App composition may import all features. This distinguishes app services from the composition root and avoids a misleading blanket rule that features cannot import `app/`.
5. Chat and the shell may render `extensions/` contributions. Extension views must not import the composer, transcript, or shell.
6. Put cross-feature overlay wiring in `AppOverlays.tsx`, not in a feature-neutral `dialogs/Dialogs.tsx`. It assembles QuickOpen, project/folder/settings containers, runtime prompts, and session dialogs. Keep `OverlayController` as the existing app-level coordinator; do not split providers in this refactor.
7. Use direct file imports. Avoid barrel files, compatibility re-export shims, and new aliases during migration. Preserve the existing `.js` import specifiers in TypeScript.
8. Dependency checks should consider type-only imports too, while distinguishing feature containers from pure views. A future lint rule may enforce this; adding a lint framework is not a prerequisite.

## Special cases and scope limits

### Widget rendering versus layout

Move `WidgetPanel.tsx` into `extensions/widgets/` first without changing behavior. In a separate step:

- Keep WidgetBlock/WidgetPanel rendering in `WidgetPanel.tsx`.
- Move WidgetDock rendering and its geometry to `WidgetDock.tsx`.
- Move `placeWidgets` and the dock breakpoint to `widget-placement.ts`, used by both App and composer.
- Keep WidgetBlock private unless the split requires reuse; if so, export it locally within this group, not through a public barrel.

The dock's hard-coded 96px header offset currently matches App's header height. After the split, optionally pass the shell offset as a prop so extension rendering no longer independently owns shell geometry. This is a follow-up, not a requirement for the initial move.

### Styling

Retain `app/styles.css` during the first migration. It owns layer order/global styles but also markdown and animation selectors. Splitting those now would mix stylesheet loading changes with file moves. Keep `SessionRow.module.css` beside SessionRow. A later CSS-only change can extract markdown/composer styles, retaining global layer declarations and animation dependencies explicitly.

### Behavioral duplication

Restart confirmations exist in both SettingsContainer and FooterContainer. Do not invent a shared action framework in the move commits. Once grouping is stable, consider an application-action helper for genuinely identical behavior. Likewise, do not merge tab-close paths automatically: busy-tab confirmation and menu actions must be reviewed for intended differences.

## Incremental implementation plan

Each step should be independently reviewable. Move existing files with `git mv`, update production/test imports in the same step, and do not leave compatibility copies.

### 1. Establish shared UI ownership

- Move `theme.ts` to `ui/theme.ts`.
- Move `DialogActions` and `dialogs/confirm/` into `ui/`.
- Update all imports, including deeper confirmation paths.
- Verify generic UI has no feature/controller imports.

### 2. Consolidate application services

- Move AppControllerContext and usePiChat directly into `app/`.
- Move both reducers to `app/state/` and FolderRequests to `app/connection/`.
- Move OverlayController to `app/overlays/`.
- Move global keyboard controller and its pure intent helpers to `app/keyboard/`.
- Keep hook/reducer behavior and public names unchanged; do not extract or redesign the WebSocket lifecycle during these moves.
- Verify application services no longer import projects or other presentation code.

### 3. Group session navigation

- Move Home, project browser, folder picker, quick-open, tabs, and close/rename dialogs into `sessions/` as shown.
- Preserve SessionRow's CSS module and Home's quick-open helper reuse.
- Update shell/dialog imports; leave Dialogs aggregation in place until step 7.
- Verify recent-session navigation, folder browsing/creation, quick-open, and optimistic tabs.

### 4. Group extension presentation

- Move runtime prompts, widget module, and runtime footer into `extensions/`.
- Rename Footer to RuntimeFooter and update its usages/tests.
- First verify the move-only commit; then split widget rendering/placement in a separate commit.
- Preserve placement order, responsive fallback, prompt focus, and lazy transcript rendering.

### 5. Group chat presentation

- Move transcript, markdown, and tool files into their chat subfolders.
- Move auto-scroll into transcript.
- Move footer container/view and command menu files into `chat/composer/`; rename the container/view to Composer.
- Preserve per-session drafts and component mount identity; do not change React keys or conditionally mount the composer differently.
- Preserve command selection, keyboard handling, focus restoration, and measured layout spacing.

### 6. Colocate preferences

- Move chime, use-chimes, and use-display-path into `settings/preferences/`.
- Update consumers in project browsing and settings.
- Preserve local-storage keys and chime lifecycle; this step is ownership cleanup only.

### 7. Finish app composition and document boundaries

- Move header pair into `app/shell/`.
- Replace Dialogs aggregation with `app/overlays/AppOverlays.tsx`, assembling all app overlays without changing their relative mounting order or provider nesting.
- App remains responsible for layout, Home/transcript choice, composer height, and widget docking; do not extract more tiny components just to reduce its line count.
- Remove now-empty legacy directories and document the six owners/dependency rules in the project documentation.
- Keep `app/main.tsx` stable so `index.html` does not need an entry-point update.

## Acceptance and verification

- Every existing frontend source file has one owner in the proposed tree; no duplicated implementations or legacy re-export paths remain.
- No changes to server protocol, SDK integration, storage keys, or user-visible behavior.
- Lazy Markdown import remains lazy; Markdown's direct tests continue targeting the implementation.
- Each step passes focused affected tests and `npx tsc --noEmit` before proceeding.
- Run the full test suite and production build at the start and after the migration: `npm test -- --run`, `npm run build`. Record any pre-existing failure separately; do not treat a failing baseline as successful verification.
- Update actual test imports/dynamic imports; do not blindly rewrite fixture strings that merely happen to mention a source path.
- Inspect `git diff --check` and rename-aware diffs. Tests remain under the existing `test/` root; reorganizing tests is a separate decision.
- Final browser smoke: Home/session selection; server-folder selection; tab switching and independent drafts; quick-open; composer suggestions; Escape abort versus modal/menu dismissal; settings/confirm dialogs; runtime prompts; narrow/wide widget placement; transcript autoscroll; reconnect/take-control.
- Confirm one application controller/WebSocket and unchanged StrictMode cleanup, stale-socket guards, request disposal, anchored notices, and failed-turn error persistence.

## Assumptions and open decisions

- The user approved and completed chat presentation grouping first, then shared UI ownership, application services with revised folder naming, session navigation, settings preferences, extension presentation, and final app composition.
- Retain the `settings/preferences/` folder as explicitly requested; chime playback helpers are colocated with the browser preference they implement.
- Six top-level responsibility folders are preferred over a `features/` wrapper: the codebase is small enough that an extra directory level adds little value.
- Current container/view boundaries are retained; additional controller selectors, action abstractions, CSS splitting, and lint tooling are optional follow-ups, not prerequisites.
