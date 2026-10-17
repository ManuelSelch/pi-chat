# Pi SDK — local migration workspace

This directory is the future `pi-sdk` repository boundary. It contains one npm
package, `@manuelselch/pi-sdk`, and a root SwiftPM package/product named `PiSDK`.
There is no standalone protocol/client package. Nothing is published.

**Current implementation: slice 3, UI-independent v1 TypeScript SDK.**
[`PiClient`](typescript/README.md) owns injectable transport lifecycle, typed
operations, bounded request tracking, immutable state and session projections.
Pi Chat's React hook is not yet switched to PiClient (slice 4); its tracker and
session-reducer logic already delegate to the SDK through migration bridges.
Swift's public target is a scaffold, not a working client. The [v2 draft](../../docs/backend-sdk/PROTOCOL.md) is still
unimplemented. V1 is a temporary baseline, not an ongoing compatibility promise.

## Layout

```text
pi-sdk/
  Package.swift                   # Future SwiftPM repository root
  Sources/PiSDK/                  # Swift public target scaffold (slice 7)
  experiments/swift-generation/   # Internal generation probe, not public API
  protocol/
    schema/v1/                    # Generated JSON Schema 2020-12 wire inputs
    fixtures/v1/                  # Shared positive/negative JSON samples
  typescript/
    package.json                  # @manuelselch/pi-sdk
    src/contract/                 # Authoritative Zod schemas and inferred types
    src/index.ts                  # SDK public entry point
    src/client.ts                 # Transport lifecycle and typed operations
    src/session-state.ts          # Shared session projection (no notice bubbles)
    src/requests/                 # Correlation, cancellation and request bounds
    scripts/                      # Export/generation/package verification
    test/                         # Schema, fixture and generation checks
```

## Public TypeScript boundary

```typescript
import { parseClientMessage, type ClientMessage } from "@manuelselch/pi-sdk";
// Server consumers can depend on the contract without client transport/state.
import { serverMessageSchema, type ServerMessage } from "@manuelselch/pi-sdk/contract";
```

Both entry points expose the same contract; only the root also exports PiClient,
transport/platform interfaces, projections and SDK errors. See the
[TypeScript API and v1 limitations](typescript/README.md). The package's **only
runtime dependency is Zod**. It builds without DOM, React, Mantine, WebSocket or
Pi runtime types. Markdown-link interpretation stays application-owned.
`src/shared/{protocol,directories,files}.ts` in Pi Chat are temporary import
bridges, not a second copy of the schemas. Build outputs import the package,
never TypeScript files across a sibling source boundary.

Neutral files are included in the npm artifact under public subpaths such as
`@manuelselch/pi-sdk/protocol/schema/v1/ClientMessage.schema.json` and
`@manuelselch/pi-sdk/protocol/fixtures/v1/valid.json`.

## Build and verify

From the Pi Chat checkout:

```sh
npm ci                                     # Builds the SDK via prepare
npm run build:sdk                          # Rebuild after editing SDK sources
npm run typecheck --workspace @manuelselch/pi-sdk
npm test --workspace @manuelselch/pi-sdk
npm run verify:package --workspace @manuelselch/pi-sdk
swift test --package-path packages/pi-sdk
npm test
npm run build
```

The TypeScript manifest/tsconfigs do not extend Pi Chat's configuration. After
repository extraction, `npm install`, `npm run build` and `npm test` from
`typescript/` use the same sources and parent `protocol/` directory.

Root `npm run dev`, `npm test`, watch tests and production builds rebuild the SDK
first. When invoking `dev:server`/`dev:web` directly, or editing SDK code during a
running dev process, run `npm run build:sdk` explicitly. This avoids concurrent
Vite/server processes rebuilding the same package outputs.

`verify:package` creates a local tarball, installs it offline into a temporary
consumer outside this checkout and verifies ESM imports, ES-only declarations,
v1 fixtures, public schema/fixture exports, PiClient lifecycle/operations,
contract-only import isolation and runtime dependency isolation. It
never publishes or pushes. The temporary consumer is removed afterward.

## Contract source and fixtures

`typescript/src/contract` is authoritative. Regenerate exported schemas with:

```sh
npm run contract:generate --workspace @manuelselch/pi-sdk
```

The fixtures cover all **19 client schema variants / 16 command types** and all
**21 server types**, plus model/default/unknown-field examples and malformed
inputs. Every sample is checked against Zod and Ajv. Tests compare exported
schemas byte-structurally against regenerated output and check discriminator
coverage against the source schemas.

Schemas describe **wire inputs**, not normalized Zod output: unknown additive
properties are allowed, defaults may be omitted, and custom path refinements are
mirrored as patterns. The v1 prompt's trimming is annotated with
`x-pi-normalization: trim`; JSON Schema validates but does not mutate data or
apply Zod defaults. Fixture `output` values document these normalizations.
The v1 extension state remains `unknown` at the Zod boundary; neutral wire
fixtures necessarily contain only JSON values. Extraction does not tighten it.
Malformed raw JSON/text frames and behavioral server guarantees remain covered
by existing transport/runtime tests, not by these shape fixtures alone.

At slice 5, replace the v1 contract/fixtures with v2 and migrate server and Pi
Chat together; do not keep dual-version support.

## Swift feasibility outcome

See the [generation probe](experiments/swift-generation/README.md). Quicktype
produces compilable Codable models and preserves nested extension JSON, but
flattens discriminated unions, loses omitted-versus-null checks and does not
apply validation/defaults. It is **not selected as an unmodified production
Swift generator**. The experiment records the gaps to address against v2 in
slice 7; its types are internal and excluded from the `PiSDK` library product.
