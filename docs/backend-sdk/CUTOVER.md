# V2 cutover — implementation checkpoint

**Slice 5 is in progress, not complete. This branch is mid-cutover and is not a
working end-to-end application checkpoint.** The server socket now speaks v2;
PiClient and Pi Chat still speak v1. There is no v1/v2 negotiation or compatibility
transport. Do not deploy this intermediate branch or mark requirements slice 5
done until the SDK/application switch and full verification are finished.

## Verified increments

- `f5f99b2`: staged typed v2 contract in
  `packages/pi-sdk/typescript/src/contract/v2.ts`, 23 methods, 17 event names,
  method-specific successful response decoding, structured failures, 29 JSON
  Schemas and valid shared examples for every request/result/event family.
- `fbb1afc`: open optional rendering hints, required core variants remain closed;
  temporary `@manuelselch/pi-sdk/contract/v2` staging entry point and generation
  command. The root SDK/contract entry points remain live v1 until cutover.
- `2f6260c`: `src/server/transport/v2-connection.ts` is a socket-independent staged
  dispatcher with 13 regression tests.
- Concrete v2 server host: `websocket-transport.ts`, `command-handler.ts` and
  `server-publisher.ts` now use the dispatcher and existing application services.
  The raw socket no longer displaces a controller: claim happens at initialized
  readiness. Same-origin browser checking, 16 MiB text/frame/send-buffer bounds,
  capability filtering, correlated results and acceptance-before-Pi callbacks
  are covered by real loopback socket tests.
- The v2 publisher assigns process-local opaque runtime IDs independently of Pi
  history IDs, tracks core sequences and independent list/presentation revisions,
  and preserves asynchronous preparation followed by fresh synchronous capture.
  Concurrent opens converge by canonical history path. Failed disposal retains
  a closing runtime, rejects further work and permits explicit close retry;
  concurrent close calls share one disposal. Disconnect leaves runtimes alive.
  File/directory/metadata/snapshot transport tests now exercise v2.

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
2. Complete server-host hardening alongside SDK integration: exercise real Pi
   steering, runtime replacement, slow-consumer overload, initialization failure
   and displaced-origin races through the actual socket, not just the dispatcher.
   Verify admission against application mutation state before returning receipts.
   Successful session creation/open now falls back to a fresh synchronous capture
   when a later extension snapshot hook fails; cover factory/replacement races
   and that fallback through the real client as part of full verification.
3. Verify lifecycle and revisions end-to-end with the SDK: fresh identities after
   close/reopen, in-place reload identity, concurrent open, partial close/archiving
   and replacement events. Do not implement a Pi scheduler or durable journal.
4. Audit error classification for every bound operation. Preserve useful structured
   domain errors without leaking unexpected implementation exception details.
   Accepted steering must settle submission rather than an existing turn.
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

Current server increment:
- Root `tsc --noEmit`, production `npm run build` and `git diff --check` pass.
- **94 transport/application tests across 15 files pass**, including the live
  socket coverage. This does **not** verify PiClient/Pi Chat integration.
- The full suite/browser/smoke have **not** passed after replacing the server wire
  path. Existing SDK, domain-driver and browser fixtures still require migration.

Previous staged-contract checkpoint (before the server wire replacement):
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
npx vitest run test/modules/server/transport test/modules/server/application
```
