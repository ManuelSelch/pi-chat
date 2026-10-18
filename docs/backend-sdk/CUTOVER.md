# V2 protocol cutover — slice 5 complete

The coordinated cutover is complete on this branch. The server, TypeScript SDK and
Pi Chat use the **v2-only** protocol. V1 schemas, generated wire artifacts and
live parsing/transport have been removed; there is no compatibility or negotiation
path. The checked-in legacy inventory remains historical documentation only.

## Implementation

- The SDK owns the authoritative Zod v2 contract, generated JSON Schema 2020-12
  artifacts, valid operation/event families and malformed fixtures. `models.ts`
  contains reusable domain schemas independent of v1 envelopes.
- The WebSocket host initializes atomically before claiming the single controller,
  validates browser origins, enforces text/frame/send bounds and filters optional
  capabilities. All 23 methods and 17 events use v2. Receipts are sent before
  accepted Pi work starts; settlement is a later `operation.finished` event.
- The publisher assigns fresh opaque runtime IDs separate from saved history
  paths, sequence watermarks, inventory/project/presentation revisions and
  current snapshots. Concurrent open-by-history-path converges. Server runtime
  storage has no active tab/focus; navigation is application-owned.
- Close retries a retained partially-torn-down runtime; confirmed close removes
  it. Disconnect never closes runtimes. The UI sends correlated `session.close`
  and restores the local tab/focus if close fails. Project history selection is
  local policy using `session.open` or `session.create`.
- PiClient performs atomic initialization, typed method-specific response
  decoding, process/runtime identity checks, immutable projections, bounded gap
  recovery, local cancellation/deadlines and explicit `unknown` outcomes. It
  never retries mutations. Observed same-run drafts survive same-process running
  snapshots; reconnect starts from authoritative snapshots and does not promise
  recovery of an unfinished stream prefix.
- Pi Chat and the shared integration/browser drivers use the SDK. Notices, focus,
  navigation, optimistic UI and error dismissal stay application-owned.
- Pi-generated message/tool identities are normalized deterministically to the
  128-character wire bound before live events and snapshots. This preserves
  stable history/event correlation without weakening v2 validation.
- Swift schema probe and shared fixture inputs now target v2. The probe remains
  a feasibility experiment, not the production Swift SDK vertical slice.

## Verification

Verified after the coordinated switch:

- Root TypeScript `tsc --noEmit` and `npm run build`.
- **1,124 root tests passed** across 131 test files.
- **32 browser/e2e tests passed**.
- **153 SDK tests passed**, plus SDK test typechecking.
- Offline packed-consumer verification passed, including v2-only exports,
  generated artifacts, initialization/operations and dependency isolation.
- Production-server smoke passed, including health/UI/PID/log/shutdown checks.
- `swift test --package-path packages/pi-sdk`: **6 tests passed**.
- `git diff --check` passed. The known dependency audit findings are unchanged.

This completes requirements slice 5 only. Production Swift networking, broader
cross-language runtime scenarios, standalone server packaging and repository
extraction remain later slices. Nothing was published or pushed.
