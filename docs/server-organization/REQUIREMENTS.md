# Server modularization plan

Status: implementation in progress; slices 1–2 complete. Slice 3 complete: session-stat rendering, message/tool mapping, and snapshot projection extracted. Slice 4 complete: model resolution/offered-model handling and SDK runtime construction are extracted; adapter entry points remain delegators. Slice 5 complete: native command dispatch, extension UI/command bindings, and shared ANSI normalization are extracted. Slice 6 complete: SDK event translation uses explicit adapter-owned projection state; subscription and watchdog ownership remain in the adapter. Slice 7 complete: catalogue types/display formatting and Pi session persistence are separated, with the store wired through bootstrap.
Scope: `src/server/` and imports into it, based on the pre-refactor checkout.

## Problem and goals

The server currently has 16 files and 2,922 lines in one directory. The main problem is mixed ownership, not the number of files:

| Current file | Lines | Responsibilities |
| --- | ---: | --- |
| `pi-runtime-adapter.ts` | 1,023 | SDK construction, message/tool mapping, native commands, models, snapshots, extension binding, event translation, abort lifecycle |
| `chat-application-service.ts` | 311 | Application facade, session lifecycle, catalogue enrichment, action dispatch, extension hooks |
| `websocket-transport.ts` | 232 | Controller lifecycle, protocol parsing, command dispatch, response routing, sequencing, snapshots |
| `project-session-service.ts` | 231 | SDK session discovery, JSONL metadata, project grouping/display, filesystem deletion |
| `extension-registry.ts` | 182 | Public extension contracts and process-wide registration/state |
| `runtime-adapter.ts` | 168 | Runtime contract and concrete test fake |

Existing boundaries are useful: transport calls the application service, the application coordinates runtime adapters, and SessionRegistry owns open runtimes. Preserve these rather than introducing a new framework.

Goals:
- Give every file a recognizable responsibility owner.
- Split the 1,023-line adapter into cohesive collaborators without distributing lifecycle state unpredictably.
- Keep contracts free of concrete runtime/test implementations.
- Make dependency direction and extension API compatibility explicit.
- Deliver small, independently verifiable changes with unchanged behavior.

Non-goals: new features, multi-user transport, protocol changes, SDK upgrades, DI containers, generic repositories/event buses, performance redesign, frontend reorganization, or wholesale test reorganization.

## Proposed layout

```text
src/server/
  index.ts                         # stable process entry point
  bootstrap/
    server.ts                      # Express/HTTP and composition root
    restart-service.ts             # process rebuild/replacement
  application/
    chat-application-service.ts    # public use-case facade and coordination
    session-registry.ts            # open runtime ownership, focus, rekey/disposal
    feature-actions.ts             # app/runtime/extension action dispatch
  transport/
    websocket-transport.ts         # socket/controller lifecycle
    command-handler.ts             # parsed client command dispatch
    server-publisher.ts            # events, snapshots, tabs/catalogue, sequences
  runtime/
    contracts.ts                   # RuntimeAdapter/Event/Snapshot/Factory
    pi/
      pi-runtime-adapter.ts        # implements the port; owns lifecycle
      runtime-factory.ts           # SDK services/runtime/session construction
      message-mapping.ts          # message identity, branch/history projection
      tool-mapping.ts             # tool cards/results, bounded text/content
      event-mapping.ts            # SDK event -> runtime events + state updates
      snapshot.ts                 # transcript/actions/footer projection
      native-commands.ts          # built-ins, precedence, command discovery
      session-stats.ts            # markdown rendering for /session
      models.ts                   # offered models, overrides, refresh helpers
      extension-bindings.ts       # UI/command-context binding to current session
      web-ui-context.ts           # ExtensionUIContext browser bridge
      pi-extension-cache.ts       # SDK loader compatibility workaround
  projects/
    project-session-service.ts     # catalogue assembly and active-session merge
    catalogue-types.ts             # application-owned catalogue/source records
    project-display.ts             # project name/display path formatting
    pi-session-store.ts            # SDK listing, JSONL metadata, safe deletion
    directory-browser-service.ts   # browse and canonical directory validation
  extensions/
    extension-registry.ts          # existing public registration API + registry
    ui/
      ui-prompt-registry.ts        # pending questions, timers, reconnect grace
      widget-registry.ts           # session-owned widget normalization/state
      status-registry.ts           # session-owned status normalization/state
      ansi.ts                     # ANSI stripping shared by status/widgets

test/
  support/
    fake-runtime-adapter.ts
```

This is the final target, not permission to create empty placeholder modules. First group existing files; then extract collaborators. Do not split every helper into its own file. Keep MessageIdentity with message mapping and keep extension API types beside their registry unless they become a separately distributed API.

File-size guidance: review files above roughly 300 lines for mixed responsibilities; aim for a substantially smaller PiRuntimeAdapter (roughly 200–300 lines). Cohesion and understandable state ownership take precedence over a hard line limit.

## Module ownership and dependency rules

### Bootstrap

`index.ts` retains environment handling, PID-file reporting, listen and signal handling. Keep its path stable: npm scripts, launcher/restart behavior and fixtures already refer to it.

`bootstrap/server.ts` is the composition root. It creates the HTTP server, production runtime factory, project store/services, application facade and transport. Preserve the injected runtime/factory seams used by integration tests. Default production dependencies should be wired here rather than constructed implicitly in otherwise SDK-independent application code.

Only bootstrap connects the concrete Pi backend to the application. No application, projects, extensions or runtime module imports bootstrap.

### Application

ChatApplicationService remains the public facade. It owns cross-capability sequencing: reload replacement, session switching/rekeying, tab lifecycle, catalogue refresh, extension hooks and shutdown. SessionRegistry stays alongside it, not under projects: live tabs are different from on-disk session history.

Extract feature dispatch into `feature-actions.ts`, with explicit dependencies for runtime lookup, extension actions, restart and notification publishing. It must not import or call back into ChatApplicationService. Do not split the facade into a service per method; it is already a reasonable size.

Application may import runtime contracts, project services/contracts, extension registry and the RestartService **type**. It must not import concrete Pi runtime modules, `ws`, Express, or SDK runtime values.

### Transport

- WebSocketTransport owns connections, controller replacement, close handling and prompt suspension/resumption.
- Command handler owns dispatch of already-parsed ClientMessage values and the existing post-command refresh behavior. It calls application operations and publisher methods; application never calls it.
- Server publisher owns protocol envelopes, per-session sequences, snapshots, tab/catalogue publishing and error serialization. It reads application state but never executes application commands.

The transport wires these collaborators with narrow callbacks/interfaces for controller lookup and sending. Neither command handler nor publisher imports the concrete WebSocketTransport class. Avoid extracting a generic message bus or pluggable connection-policy framework.

Protocol schema and browser-facing DTOs stay in `src/shared/`; server contracts do not move there unless genuinely needed by the browser. Only transport/bootstrap use `ws`/HTTP/Express implementation APIs.

### Runtime

Move RuntimeAdapter, RuntimeEvent, RuntimeSnapshot and RuntimeAdapterFactory into `runtime/contracts.ts`. Move FakeRuntimeAdapter to test support; it is currently consumed by tests, not production. Preserve its real prompt registry/browser UI behavior rather than replacing it with auto-cancelled prompts.

The Pi backend owns SDK runtime construction and adaptation. Its helpers may use SDK types/values; they do not know about sockets, tab registries, project browsing, restart or ChatApplicationService.

The adapter retains the mutable session lifecycle and a single event subscription. Helpers must not receive the whole adapter or reach into its private fields.

| State/resource | Owner after extraction |
| --- | --- |
| AgentSessionRuntime and current session subscription | PiRuntimeAdapter |
| MessageIdentity instance | PiRuntimeAdapter, passed to message/snapshot/event mapping |
| currentRunId, lastError, inFlightTools | one adapter-owned state object, shared explicitly with event/snapshot helpers |
| cached offered-model list | PiRuntimeAdapter; models helpers resolve/refresh it |
| abort watchdog and its cancellation | PiRuntimeAdapter |
| prompts, widgets, statuses and current UI context | per adapter, using existing registries |
| process-wide web extension registrations | existing extension registry singleton |

`event-mapping.ts` accepts the current session, explicit projection state and emit callback. It translates events and updates that state; it does not subscribe, own timers or dispose the adapter. `snapshot.ts` reads current session/state/registries and uses the same mapping functions as live events. It does not start extensions or mutate global registrations.

Construction helpers return a runtime; the adapter's static create/open/new entry points can delegate to them. This avoids factory -> adapter -> factory cycles. Extension binding helpers receive explicit handlers; they do not own session replacement. On rebind, always resolve `runtime.session` afresh rather than retaining the old session in closures.

Extract native command handling with explicit operations (compact, refresh/set model, set thinking, ask prompt, notify). Keep /reload in the application because it replaces an adapter. Models remain resolved through the extension-loaded services/runtime.

### Projects

ProjectSessionService owns project grouping, sorting, formatting and merging the active session into history. `pi-session-store.ts` owns persistence-specific details: SessionManager.listAll(), agent sessions root, latest JSONL name metadata, and trash/unlink deletion safeguards.

Use a small source interface returning application-owned records (including the dates/name-source information required by current behavior). Do not leak SDK SessionInfo into application contracts or invent a generic persistence framework. DirectoryBrowserService remains a separate small service within this owner; directory browsing and session-file deletion have different permission policies.

### Extensions

The web extension registry is distinct from Pi's SDK extension loader/cache. Keep the former here and the latter in runtime/pi. Session-owned UI registries are reusable host state, not process-wide registrations.

Move stripAnsi into `extensions/ui/ansi.ts`; StatusRegistry should not depend on WidgetRegistry just to strip text.

SDK boundary nuance: the current RuntimeAdapter.uiContext() and public extension action context expose the full SDK ExtensionUIContext. Preserve this API. Type-only SDK imports in runtime contracts and the extension registry are an explicit exception; claiming the entire application API is SDK-neutral would be inaccurate. Replacing that UI type with an application-owned contract is a separate API decision, not required by this reorganization.

### Imports and compatibility

- Use explicit file imports with existing `.js` specifiers; no new aliases or catch-all barrel files.
- No cyclic imports, including type-only cycles. Shared contracts must not import implementations.
- Update source, tests, scripts and examples with each move. Inspect dynamic imports and mock paths too.
- `scripts/verify-slice1.ts` currently imports the server and adapter directly.
- `docs/extension-api.md` and the demo import `src/server/extension-registry.ts`. Treat that documented path as a compatibility surface, not an ordinary internal import.
- Retain a thin deprecated `src/server/extension-registry.ts` re-export of the canonical registry during migration; both paths must resolve to the same implementation and global singleton. Update docs/examples to the canonical path. Remove the shim only in an explicitly announced compatibility-breaking change. Do not retain shims for ordinary internal files.
- This proposal is independent of the untracked `docs/web-organization/` plan; do not change it as part of server work.

## Behavior that must not change

1. Multiple open runtimes/tabs, duplicate-session focus, session replacement/rekeying, and last-tab Home behavior.
2. One controlling browser; displaced controller close code 4001, no takeover reconnect loop, prompt disconnect grace/resume.
3. Per-session sequence ordering and snapshot throughSequence semantics; reconnect reconstructs every open tab.
4. Correlated directory/session-open replies go only to the originating current controller. Successful creation remains success even if subsequent refresh fails.
5. Prompt/action refreshes, catalogue updates and tab status/name updates preserve their existing order and behavior.
6. One MessageIdentity instance shared by live events and snapshots; deterministic tool IDs, args/result merge, interrupted-tool recovery, custom branch messages, reasoning and write/edit projections remain identical.
7. lastError survives settled events/snapshots and clears on the next prompt. Abort watchdog cleanup and compaction busy-state behavior remain intact.
8. Extension startup happens after UI binding; session replacement rebinds UI and command context and refreshes models after extension startup. Session-specific registries are cleaned up appropriately.
9. Native command precedence and unsupported-terminal-command warnings remain unchanged. /reload replaces only the target runtime and invalidates the SDK extension cache.
10. Model override/scoped-model resolution, enabledModels fallback and settings reload retain their current behavior.
11. Directory canonicalization, symlink/relative/home handling, pagination and session-deletion guards remain unchanged. No new filesystem sandbox or security policy is implied.
12. Restart capability, build failure recovery, launcher/PID behavior, static assets, health endpoint and shutdown order remain unchanged.

## Incremental implementation plan

For each slice: establish relevant baseline tests, make the smallest change, update imports/tests, run focused tests and TypeScript, inspect rename-aware diff and whitespace. Keep moves and behavioral extraction in separate commits.

### 1. Group existing files only

Move files into bootstrap/application/transport/runtime/pi/projects/extensions as described, keeping implementations intact. Initially `runtime/runtime-adapter.ts` still contains the fake. Keep stable index.ts and the extension registry compatibility shim. Update scripts/examples/docs/test imports and relative shared imports.

Acceptance: same exports and behavior; entry point works; full test suite and build pass.

### 2. Separate contracts and test support

Create runtime/contracts.ts from existing runtime types plus RuntimeAdapterFactory. Move fake into test/support. Application/bootstrap/test imports target contracts or the fake directly. Remove the old runtime-adapter implementation file.

Acceptance: contracts import no registries, fake or concrete Pi implementation; integration tests still exercise real prompt lifetimes.

### 3. Extract pure runtime projections

Extract session-stats, message-mapping and tool-mapping first. Keep identity creation in the adapter and share tool mapping across history and live events. Move existing pure-function tests to direct imports from the new owners without weakening assertions. Extract snapshot projection in a separate commit after mapping is stable.

Acceptance: message mapping, write-content, edit-diff, custom-message, error persistence and snapshot behavior remain covered.

### 4. Extract models and SDK construction

Extract models and runtime-factory; retain static adapter entry points as delegators. Move production factory composition into bootstrap. Keep the extension cache workaround isolated.

Acceptance: offered-model tests and model-refresh tests pass; production runtime smoke confirms provider/model resolution and extension startup. Do not change offeredModels filtering during extraction.

### 5. Extract command and extension bindings

Extract native commands and command discovery, then UI/command-context bindings. Move web-ui-context to its final runtime/pi owner. Extract ANSI normalization separately.

Acceptance: command precedence, /session markdown, extension UI/prompts/widgets/statuses, /reload, and extension-triggered session switching/rebinding pass existing tests.

### 6. Extract event translation

Introduce the explicit adapter-owned projection state and pass it to event/snapshot helpers. Keep subscription setup/teardown, abort timers, rebind sequencing and disposal in the adapter.

Acceptance: abort/compaction tests, live tool events, persistent failures, session switches, and full runtime adapter tests pass. Mapping helpers never import the adapter. Tests currently instantiate the private constructor through casts: retain that seam initially rather than changing the construction API and extraction simultaneously.

### 7. Separate project persistence from catalogue assembly

Extract catalogue-types/project-display, then pi-session-store. Inject the store through bootstrap; adapt existing test lister fixtures to the small source interface. Preserve metadata/error behavior and deletion policy exactly.

Acceptance: project catalogue, current-session merge/name-source, deletion, directory browser, Home/folder protocol integration tests pass; ProjectSessionService imports no SDK runtime values.

### 8. Extract application feature dispatch

Extract feature-actions without changing ChatApplicationService's public methods or moving session/reload coordination out of it. Preserve guards and notifications; do not normalize differences among controls as part of cleanup.

Acceptance: application service and extension action tests pass, including actions with no session and unavailable restart.

### 9. Separate transport dispatch and publication

Extract server-publisher, then command-handler in separate commits. Controller ownership remains with WebSocketTransport and is passed through explicit callbacks. Preserve socket-targeted reply guards and sequencing across asynchronous work.

Acceptance: full WebSocket/folder protocol integration tests pass; reconnect/takeover smoke succeeds. No transport collaborator imports WebSocketTransport to call private methods.

### 10. Finish boundaries and documentation

Remove empty legacy locations (except the intentional extension API shim). Document owner/dependency rules and update all internal import paths. Add a lightweight import-boundary regression check if feasible using existing tooling, covering type imports and excluding the intentional compatibility shim. Do not add a lint framework just for this refactor.

Acceptance: no accidental dependency cycles, no concrete Pi/transport imports in application, no implementation imports in contracts, no browser imports into server, no runtime/bootstrap dependencies in reusable UI registries.

## Verification and handover

At migration start and finish run:

```sh
npm test -- --run
npx tsc --noEmit
npm run build
git diff --check
```

Record baseline failures separately. These commands have not been run for this documentation-only proposal; do not interpret historical memory test counts as current verification.

Final production smoke: start server; health/static page; Home and server folder selection; create/resume multiple tabs; prompt/tools and independent tab status; abort and compact; model/thinking controls; extension prompt/widget/status; extension-triggered session switch; reload changed extensions; browser reconnect/take control; close last tab; delete a disposable session; restart success and simulated build failure. Use temporary sessions/folders for destructive checks.

Existing tests stay in the test root except the fake support file. Add focused characterization tests before changing an untested stateful boundary; do not rely solely on typechecking or update expected behavior just to make the refactor pass.

## Assumptions and decisions

- This is a planning deliverable, not approval to implement.
- Grouping may increase the file count; success is coherent ownership and shorter mixed-responsibility files, not fewer files.
- Six named owners are preferred over generic services/utils folders or a features wrapper.
- Keep full ExtensionUIContext compatibility and the documented registry import shim; API redesign is deferred.
- No behavioral issues discovered during implementation should be fixed silently in move/extraction commits; track them separately with reproducing tests.
