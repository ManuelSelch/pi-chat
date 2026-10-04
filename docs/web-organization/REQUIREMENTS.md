# Frontend grouping plan

Status: partially implemented; shared UI ownership (step 1) and chat presentation grouping (step 5) are complete.
Scope: `src/web/` in the current checkout.

## Completed scope

Implemented step 5 first at the user's request:

- Grouped transcript, Markdown, and tools under `chat/transcript/`, `chat/markdown/`, and `chat/tools/`.
- Moved auto-scroll into transcript and command-menu files into `chat/composer/`.
- Moved/renamed FooterContainer and FooterView to ComposerContainer and ComposerView; updated App and test imports.
- Application state/transport and runtime footer/widgets remain at their existing paths until steps 2 and 4. No compatibility shims were introduced.
- Fixed three pre-existing DOM test failures by awaiting lazy Markdown rendering. No production behavior changed.

Verification: all 49 test files / 390 tests pass, TypeScript and production build pass, and whitespace checks pass. All 14 relocated modules were compared with the originals: only import paths and Composer naming changed. The production CSS, Markdown, and main bundle hashes match the baseline. No browser smoke was run for this move-only step.

Implemented step 1 next at the user's request:

- Moved theme tokens to `ui/theme.ts`, shared dialog actions to `ui/DialogActions.tsx`, and generic confirmation modules to `ui/confirm/`.
- Updated all source and test imports; feature-specific close/rename dialogs remain in `dialogs/`.
- Verified every relative dependency in `ui/` stays within `ui/`; no feature or controller imports remain.
- All source/test changes are file moves and import-path updates only. No compatibility copies or behavior changes.

Verification: all 49 test files / 390 tests pass, TypeScript and production build pass, and whitespace checks pass. Production CSS, Markdown, and main bundle hashes match the baseline. No browser smoke was run for this move-only step.

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
    controller/
      AppControllerContext.tsx
      use-pi-chat.ts
      app-state.ts
      chat-state.ts
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

**App:** owns startup, composition, connection/controller state, overlay coordination, and global keyboard routing. Keep both reducers together in `app/controller/`: `ChatState` is a session projection containing settings, prompts, widgets, and transcript data, not just chat UI state. Keep existing names and exports initially; renaming `ChatState` to `SessionState` is not necessary for grouping.

**Chat:** owns reading/writing a conversation. Rename `FooterContainer`/`FooterView` to `ComposerContainer`/`ComposerView`; they own drafts, submission, suggestions, and composer measurement. `use-auto-scroll` belongs to the transcript, its actual consumer. Markdown is shared by transcript/tool rendering within chat; do not move it to generic `ui/` yet.

**Sessions:** owns selecting, creating, resuming, closing, renaming, and deleting sessions, including the Home entry screen. Keep quick-open ranking shared between Home and QuickOpen within this owner. Folder UI belongs here; correlated requests belong to the controller. Settings and composer may invoke session actions without importing session containers.

**Settings:** owns persistent browser preferences and their controls. Move chime and path-display helpers here. Preserve the existing lifetime of `useChimes`: `SettingsContainer` is mounted even when its drawer is closed. Do not accidentally mount notification playback only while the drawer is visible.

**Extensions:** owns protocol-driven extension presentation: slots, widgets, runtime footer metadata, and runtime UI prompts. `PromptModal` represents server/extension `ctx.ui` interaction, not an ordinary application confirmation. Rename `chat/Footer.tsx` to `RuntimeFooter.tsx` so it cannot be confused with the composer. Its entries include core runtime model metadata as well as extension labels; this group is for runtime contributions, not exclusively external plugins.

**UI:** owns application-independent primitives and generic confirmation. `DialogActions` is already used by feature dialogs and the project drawer, so move it here. Move the shared theme tokens here too. Do not move business-specific dialogs into `ui/` just because they use Mantine Modal.

## Dependency requirements

1. `app/controller/` may import shared protocol/directory types and its own modules, but no presentation features. Moving `folder-requests.ts` removes its current dependency on `projects/`.
2. `ui/` must not import application context or feature modules. Generic confirmation is allowed to depend on other `ui/` files.
3. Feature containers may import `app/controller/` and `app/overlays/OverlayController.tsx`. Feature views should retain their existing prop-driven APIs; do not introduce controller access into views merely to shorten props.
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

- Move AppControllerContext, usePiChat, both reducers, and FolderRequests into `app/controller/`.
- Move OverlayController to `app/overlays/`.
- Move global keyboard controller and its pure intent helpers to `app/keyboard/`.
- Keep hook/reducer behavior and public names unchanged.
- Verify controller no longer imports projects or other presentation code.

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

- The user approved and completed chat presentation grouping first, then shared UI ownership. Steps 2, 3, 4, 6, and 7 remain proposed.
- Six top-level responsibility folders are preferred over a `features/` wrapper: the codebase is small enough that an extra directory level adds little value.
- Current container/view boundaries are retained; additional controller selectors, action abstractions, CSS splitting, and lint tooling are optional follow-ups, not prerequisites.
