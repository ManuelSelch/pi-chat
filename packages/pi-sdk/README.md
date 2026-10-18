# Pi SDK — local v2 workspace

This is the future `pi-sdk` repository boundary: one npm package,
`@manuelselch/pi-sdk`, plus a root SwiftPM package/product named `PiSDK` and the
shared protocol contract. There is no separate protocol/client package. Nothing
is published.

**Current implementation: slice 5 complete.** Pi Chat's server, TypeScript SDK
and web application use the coordinated **v2-only** protocol. V1 wire schemas,
fixtures and parsing were removed; no compatibility/negotiation path remains.
The `PiClient` is UI-independent and owns transport lifecycle, atomic
initialization, typed requests/results, bounded correlation and immutable session
projections. Browser navigation, focus, notice anchors and optimistic UI remain
application-owned. The Swift library remains a scaffold; the current quicktype
probe is a schema feasibility test, not the slice-7 production SDK.

## Layout

```text
pi-sdk/
  Package.swift                   # SwiftPM scaffold
  Sources/PiSDK/                  # Swift target, production vertical slice deferred
  experiments/swift-generation/   # Internal v2 generation probe, not public API
  protocol/
    schema/v2/                    # Generated JSON Schema 2020-12 artifacts
    fixtures/v2/                  # Shared operation/event/domain and malformed samples
  typescript/
    package.json                  # @manuelselch/pi-sdk
    src/contract/models.ts        # Reusable domain schemas, independent of envelopes
    src/contract/v2.ts            # Authoritative Zod v2 wire contract
    src/client.ts                 # Lifecycle, requests and projections
    src/session-state.ts          # Sequenced per-runtime reducer
    src/requests/pending-requests.ts # Bounded correlation/cancellation
    scripts/                      # Generation and packed consumer verification
    test/                         # SDK, Zod/Ajv, fixture and drift checks
```

## Public TypeScript boundary

```ts
import { PiClient, PROTOCOL_VERSION, type Request, type Event } from "@manuelselch/pi-sdk";
import { requestSchema, serverMessageSchema } from "@manuelselch/pi-sdk/contract";

const request: Request<"message.send"> = {
  version: PROTOCOL_VERSION, type: "request", requestId: "request-1",
  method: "message.send", sessionId: "runtime-id", params: { message: "Hello" },
};
```

The root entry also exports the client, transport/platform interfaces, immutable
state types, projections and errors. The contract-only entry does not import the
client. The **only runtime dependency is Zod**; the package has no DOM, React,
Mantine, WebSocket implementation or Pi runtime dependency. Server-side extension
APIs remain separate from wire-contract concerns. Markdown-link interpretation
is application-owned.

Neutral files ship under
`@manuelselch/pi-sdk/protocol/schema/v2/Request.schema.json` and
`@manuelselch/pi-sdk/protocol/fixtures/v2/valid.json` (plus domain and malformed
fixtures).

## Build and verify

```sh
npm run build:sdk
npm run typecheck --workspace @manuelselch/pi-sdk
npm test --workspace @manuelselch/pi-sdk
npm run verify:package --workspace @manuelselch/pi-sdk
swift test --package-path packages/pi-sdk
npm test
npm run test:e2e
npm run test:production-smoke
```

`contract:generate` regenerates v2 JSON Schemas and shared fixture files from the
checked-in TypeScript schema/example sources. Schema and fixture drift tests
compare checked-in outputs; Zod and Ajv validate the same valid/malformed wire
families. Package verification packs locally and installs offline in a temporary
consumer, checks ESM/type imports and runs the SDK without sibling-source imports;
it never publishes or pushes.

The root npm lifecycle rebuilds this workspace before root tests and builds. If
you invoke server/web tooling directly after editing SDK source, run
`npm run build:sdk` first. Never run a clean SDK build concurrently with tests
importing its `dist` output.

## Swift generation outcome

The [generation probe](experiments/swift-generation/README.md) is refreshed from
v2 shared schemas/fixtures. Quicktype produces compiling Codable models and keeps
nested JSON, but flattens discriminated unions, accepts invalid null optionals and
does not apply validation/defaults. It is **not selected as an unmodified
production generator**. Slice 7 owns the production Swift API/toolchain decision.
