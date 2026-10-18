# V2 cutover — implementation checkpoint

**Slice 5 is in progress, not complete. The running application still uses v1.**
There is no v1/v2 negotiation or compatibility transport. The staged contract and
dispatcher are intentionally not wired into the live socket until the server,
SDK and Pi Chat can be switched together. Do not mark requirements slice 5 done.

## Verified increments

- `f5f99b2`: staged typed v2 contract in
  `packages/pi-sdk/typescript/src/contract/v2.ts`, 23 methods, 17 event names,
  method-specific successful response decoding, structured failures, 29 JSON
  Schemas and valid shared examples for every request/result/event family.
- `fbb1afc`: open optional rendering hints, required core variants remain closed;
  temporary `@manuelselch/pi-sdk/contract/v2` staging entry point and generation
  command. The root SDK/contract entry points remain live v1 until cutover.
- `2f6260c`: `src/server/transport/v2-connection.ts` is a socket-independent staged
  dispatcher with 13 regression tests. It is **not** yet a WebSocket transport or
  a ChatApplicationService host adapter.

The dispatcher tests cover initialization preparation before controller claim,
fresh synchronous capture and initial response queueing, required initialization,
capability selection, v1 rejection, unknown methods, duplicate-ID/size/pending
limits, initial-sync deadline, acceptance before synchronous Pi callbacks, prompt
and abort responsiveness during long work, displaced origins, admitted work
surviving disconnect, failed post-response refresh and uncertain responses.

`V2ConnectionHost.execute` must only validate/admit before returning an accepted
execution; it must not start runtime work or emit its related events before the
dispatcher invokes `run`. Completed mutations put nonessential publication work
in `afterResponse`, so a failed refresh cannot turn success into rejection.
The host/publisher must supply controller ownership, per-runtime sequencing,
snapshot preparation/capture, optional-capability filtering and socket bounds.

## Remaining implementation

1. Separate reusable domain schemas from `contract/protocol.ts`; the staged v2
   schema still imports shared model primitives there. Replace the live root
   contract/exports with v2 at the coordinated cutover, not a compatibility layer.
2. Implement the concrete server host and v2 publisher, then replace the current
   `websocket-transport.ts` / `command-handler.ts` wire path. Add origin checking,
   maxPayload/send-buffer enforcement, initialization timeout cleanup and all
   connection teardown. Actual controller admission must occur only at the
   initialization barrier, not on raw socket connection.
3. Introduce fresh runtime IDs distinct from Pi history IDs, convergent concurrent
   open-by-path, structured settings, explicit close/partial-teardown behavior,
   runtime-replacement events and independent inventory/project/presentation
   revisions. Preserve atomic asynchronous-prepare/synchronous-capture snapshots.
   Do not implement a Pi scheduler or durable operation journal.
4. Bind every v2 operation to the existing Pi/application services. Distinguish
   validation/admission from eventual settlement. Accepted steering settles its
   submission, not the already-running turn. Preserve useful structured errors;
   unexpected implementation errors must not leak private exception details.
5. Replace PiClient's v1 trackers with one typed v2 pending-request mechanism;
   implement initialization, process identity, fresh projections, non-stale
   snapshots, bounded gap buffering/snapshot recovery, local cancellation and
   explicit unknown outcomes. Never replay mutations. Optional unknown rendering
   hints must be ignored by views rather than fail required state decoding.
6. Remove wire-level tabs/focus/project-continuation from Pi Chat. Keep navigation
   and project-history selection application-owned; close a client tab through
   correlated `session.close` and retain/restore it on failure. Migrate shared
   binding/domain integration drivers and DOM/browser fixtures to v2.
7. Replace/remove the live v1 contract/artifacts and update contract generation,
   package-consumer verification and the Swift generation probe to the final v2
   source. Add malformed fixtures and end-to-end v1 rejection, accepted/lost
   response, timeout, refresh-failure and no-replay scenarios.
8. Re-run isolation checks, the full pipeline and Swift probe; update requirements,
   architecture, SDK API docs and handover only when the coordinated switch works.

See [protocol section 8](PROTOCOL.md#8-open-decisions-and-rollout) for the selected
custom envelopes, admission semantics, process-local outcomes, no unfinished
stream-prefix guarantee, limits, explicit ping and partial teardown decisions.

## Verification at this checkpoint

- Full pipeline passed: build/typechecking, **1,155 tests**, **32 browser tests**,
  production smoke. The browser/production tests still exercise the live **v1**
  stack; this is not an assertion that v2 runtime integration works.
- SDK typechecking and **178 SDK tests** passed, including staged v2 contract
  fixtures/Zod/Ajv agreement and schema regeneration drift.
- Offline packed SDK consumer verification passed (live v1 API).
- `git diff --check` passed. Existing dependency audit warnings remain unchanged.

Regenerate staged schemas/examples with:

```sh
npm run contract:generate:v2 --workspace @manuelselch/pi-sdk
npm run typecheck --workspace @manuelselch/pi-sdk
npm test --workspace @manuelselch/pi-sdk
npx vitest run test/modules/server/transport/v2-connection.test.ts
```
