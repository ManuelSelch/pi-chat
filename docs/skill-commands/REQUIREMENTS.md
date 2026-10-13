# Pi Chat Skill Slash Commands — Requirements

## Goal
Invoke loaded skills through `/skill:name [task]` in Pi Chat, using Pi's existing SDK behavior and the existing browser slash-command menu rather than implementing a second skill system.

## Scope
### In Scope
- Session-specific skill discovery in the existing slash-command catalogue.
- Pi terminal's canonical `/skill:name` syntax and discovery setting.
- Existing keyboard/mouse completion, prompt submission, resource reload, and session switching.
- Compact `[skill] <name>` headers for agent read calls targeting `SKILL.md`, matching Pi terminal.
- Collapsed skill invocation disclosures with separately displayed task text, matching Pi terminal.
- Regression tests and isolated real-SDK/browser verification.

### Out of Scope
- Bare `/name` aliases, a separate `/skills` picker, or a new skills management/settings UI.
- Browser-side filesystem scanning, frontmatter parsing, or instruction expansion.
- New WebSocket messages, endpoints, queues, or an execution framework.
- Skill-specific argument providers or terminal filesystem completion.
- Allowing slash commands during a live run; preserve Pi Chat's existing idle-only command policy.
- Changes to SDK skill expansion, execution, or error/fallback semantics.
- General terminal renderer parity for docs, other resources, or unrelated tools.
- Changes to the unrelated root steering requirements document.

## Requirements
- Read skills from the active SDK session's `resourceLoader.getSkills().skills`; Pi remains responsible for discovery, configured resource paths, package resources, trust, validation, and skill-name collisions. Do not scan directories independently or hardcode the user's skill paths.
- When `session.settingsManager.getEnableSkillCommands()` is true, expose each loaded skill as `skill:<name>` with its description and `source: "skill"`. Extend the existing `slashCommandSchema.source` enum to accept `skill`; preserve compatibility with existing command sources and omitted source values.
- When the setting is false, omit skill rows from discovery only. Manually typed `/skill:name` still goes through normal SDK submission and remains usable, matching Pi terminal behavior.
- Include skills with `disableModelInvocation: true` in explicit-command discovery. That flag hides automatic model routing, not explicit invocation.
- Publish one menu row per invocation name. Preserve existing extension/native precedence, and suppress a skill row when an extension or prompt template already occupies its exact `skill:<name>` invocation. Extensions execute before skill expansion; skill expansion followed by prompt expansion prevents a conflicting template from executing as an ordinary template. Do not introduce bare-name aliases.
- Reuse alphabetical catalogue ordering, descriptions, and the menu's existing source badge. `/`, `/skill:`, and partial skill-name queries must find matching skill commands through the current filter. Enter, Tab, and mouse selection insert `/skill:name ` without executing; the next submission invokes it, with or without task text. Escape retains existing dismissal behavior.
- Submit the literal command through the existing application/adapter prompt path. The SDK reads the skill file at invocation time, strips frontmatter, includes its file location and base-directory reference, and appends task text. Do not duplicate this expansion or convert the command to a tool call.
- Preserve SDK extension-command precedence and raw `input` interception before skill expansion. Keep current bash, compaction, abort, and running-command guards.
- Preserve SDK-owned transcript content and live/snapshot identity. Expanded skill instructions remain part of the original SDK user message; do not add a synthetic tool call, second history entry, or history store. Use Pi's exported `parseSkillBlock()` in the server message projection to attach skill name, location, and content as optional display metadata on that same user message. The projected text contains only the appended task, or an empty string when absent. Do not duplicate the full skill prompt across metadata and text.
- Render projected skill metadata as a collapsed `[skill] <name>` disclosure without tool running/success status. Expansion reveals the location and instructions using existing safe Markdown rendering. Display appended task text once in a normal user bubble; do not render an empty bubble for a skill-only invocation. Apply the same projection/rendering to live events and restored snapshots. Non-user messages, malformed blocks, and unexpanded unknown commands retain ordinary rendering.
- Resource reload and session/workspace changes must refresh the catalogue through existing snapshots. Use the current session's loader/settings rather than a process-global or browser-owned skill cache. Other tabs retain their own resources.
- Unknown skill names retain SDK pass-through behavior. Unreadable skill files retain SDK error emission and literal-text fallback; do not invent a custom rejecting preflight or silently claim that loading succeeded.
- Verify no remote argument-completion request is introduced for a normal skill row; existing argument providers are extension-only. A real extension occupying a skill-shaped invocation retains its existing argument provider.
- When an agent `read` call targets a file whose basename is exactly `SKILL.md`, show `[skill] <parent-directory>` in the collapsed tool header instead of `read <full-path>`. For example, reading `/Users/manuelselch/.pi/agent/skills/daily-briefing/SKILL.md` displays `[skill] daily-briefing`. Match Pi's filename-based classification, not frontmatter names or membership in the loaded skill catalogue; this presentation remains enabled when `enableSkillCommands` is false.
- Apply skill-read presentation to both live tool events and snapshot/history cards, retaining the original `read` tool name, call id, arguments/full path, result content, and running/success/error status underneath. Expansion still reveals the real read details; failed reads must remain visibly failed. Non-skill reads and other tools retain their current presentation. Do not generate a synthetic skill tool call for `/skill:name` expansion.
- Recognize `file_path` as well as `path`, with `file_path` precedence, matching Pi's read renderer. Handle absolute, relative, and home-prefixed paths without filesystem access. Only classify a complete path value, not an unfinished streamed string that merely ends in `SKILL.md` so far. Preserve existing partial-argument display until classification is reliable. Retain Pi-style line-range suffixes when offset/limit are supplied.

## Assumptions
- Canonical `/skill:name` syntax is desired, rather than bare `/name` aliases. This matches Pi terminal and avoids collisions with existing commands.
- Reviewed SDK is `@earendil-works/pi-coding-agent` 1.0.2, matching the project's declared version. This worktree currently has no installed dependencies; the installed SDK in the primary checkout was inspected.
- No UI redesign is necessary: the current menu accepts colon-containing names and renders the source badge generically. If a redesign is later requested, obtain mockup approval separately.
- Existing SDK error visibility is not expanded by this feature. `skill_expansion` file-read errors are emitted through the extension runner; Pi Chat currently binds no SDK `onError` listener. Reporting those errors in the browser is a separate decision.

## Implementation Plan
### 1. Session Skill Catalogue
Description: Extend `src/shared/protocol.ts` to accept the skill source and add skill projection to `PiRuntimeAdapter.commands()` in `src/server/runtime/pi/pi-runtime-adapter.ts`. Use the current session loader and enable setting; append only unoccupied names and retain sorting. Update adapter test doubles with the required settings API. Add protocol and catalogue tests for descriptions, enabled/disabled discovery, explicit-only skills, empty resources, exact-name collisions, and distinct skill names. Verify focused tests and typechecking. No submission or transport changes.

### 2. Invocation and Resource Lifecycle Regressions
Description: Depends on slice 1. Add isolated real-SDK tests using temporary skills and a deterministic local stream stub, following existing SDK test patterns. Verify expansion with and without task text, frontmatter removal, location/base-directory references, raw input interception, extension precedence, unknown names, and manually entered commands when discovery is disabled. Capture extension-runner errors for the SDK's missing-file fallback without changing browser error handling. Verify changed files are read on invocation and reload refreshes added/removed skill rows and settings. Cover current-session resource replacement and live/snapshot user-message consistency. Keep tests network-free and isolated from personal resources.

### 3. Compact Skill Read Headers
Description: Add a narrowly scoped presentation helper for `src/web/chat/tools/ToolCard.tsx` that classifies complete read paths ending in `SKILL.md` and supplies `[skill]` plus the parent-directory label and optional line range. Reuse the existing tool card and disclosure; leave protocol tool identity and server execution unchanged. Add helper/DOM tests covering `path`/`file_path` precedence, absolute/relative/home-prefixed paths, exact filename matching, malformed and partial arguments, unrelated reads/tools, offset/limit including null values, failed/running/completed states, and expansion retaining full arguments/results. Verify equivalent presentation for a live card and the same card restored from a snapshot. This slice is independent of slash-command execution; the requested header format is fixed and needs no layout redesign.

### 4. Compact Skill Invocation Messages
Description: Reuse the SDK parser in the existing server message mapper and add optional skill metadata to the existing user-message protocol. Keep the original SDK message unchanged and preserve its projected identity. Add a small `SkillInvocation` transcript component using native details/summary, collapsed by default, and retain the normal user bubble only for appended task text. Verify parser fidelity, original SDK content, protocol round-trip, malformed/non-user fallbacks, safe expansion, with/without task text, compact mode, and live/restored snapshot parity using mapping, real-SDK, and DOM regressions. No synthetic tool calls or execution changes.

### 5. Browser Parity and Verification
Description: Depends on slices 1–4. Extend existing menu/composer tests for `/skill:` filtering, descriptions/source badges, keyboard and mouse insertion without execution, task submission, no-argument submission, Escape, and absence of skill argument-completion requests. Verify session-specific catalogues through tab changes and reconnect snapshots. Run an isolated browser smoke with a real Pi runtime and fixture skill; confirm invocation, reload, unchanged busy-command guards, and `[skill] <name>` headers for an actual agent skill read, both live and after reconnect. Verify expansion still exposes its path and content. Install worktree dependencies as needed, run focused tests, full suite, typechecking, production build, and whitespace checks; distinguish baseline failures. Document canonical syntax and discovery-setting behavior in README. Commit completed, verified implementation slices without pushing.

## Open Questions
None.
