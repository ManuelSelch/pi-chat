# Swift model generation feasibility

Slice 2 experiment only. These internal generated types are **not** exported by
`PiSDK` and are not the Swift client SDK. The public Swift target is a scaffold;
transport, projections, concurrency APIs and the stable Xcode/Swift/iOS baseline
belong to slice 7.

## Reproduce

From the Pi Chat checkout:

```sh
npm ci
npm run probe:swift:generate --workspace @manuelselch/pi-sdk
swift test --package-path packages/pi-sdk
```

The pinned `quicktype-core@26.0.0` consumes the checked-in language-neutral schemas
for `ChatMessage`, `ThinkingLevel`, `ExtensionContributions`, `FooterItem` and
`PromptResult`. The TypeScript test regenerates and compares the entire output;
Swift tests consume the same JSON fixtures as the Zod/JSON Schema tests.

Verified locally with Apple Swift 6.2.1 (`swiftlang-6.2.1.4.8`), arm64 macOS 26.
This records the experiment environment, not the future iOS support baseline.
`final-classes: true` is necessary for generated `JSONCodingKey` to conform to
Swift 6's `CodingKey`/`Sendable` requirements without unsafe annotations.

## Results

- Compiles through SwiftPM in Swift 6 language mode.
- Decodes 16 representative valid inputs, including every message role from the
  rich snapshot, omitted optionals, enums, booleans/strings and Unicode text.
- Nested extension JSON preserves objects, arrays, strings, booleans, numbers
  and null on encode/decode. Unknown additive fields are ignored.
- Unknown required enum values are rejected.
- **Discriminated unions are flattened:** role-specific fields become optional
  on one struct. For example a tool message without `tool`, or a non-cancelled
  prompt answer without `value`, is incorrectly accepted.
- **Omission versus null is lost:** `decodeIfPresent` accepts a null timestamp
  that the contract rejects.
- **JSON Schema defaults are not applied:** footer alignment/variant and empty
  extension collections remain nil. String/numeric bounds and custom path
  refinements are also not Codable validation.
- Generated `JSONAny` uses `Any`, not a typed recursive, concurrency-safe JSON
  value. Successful decoding is not a claim of native async SDK suitability.

The tests explicitly demonstrate these gaps; they do **not** weaken the wire
contract to accommodate a generator.

## Decision

Do not adopt unmodified quicktype output as the production Swift contract.
Zod remains authoritative and exports input JSON Schema plus shared positive and
negative fixtures. This spike proves schema-to-Codable feasibility, but not
validator equivalence. Slice 7 must implement discriminator-aware decoding,
omitted/null checks, constraints/default behavior and a typed JSON value, and
verify them against these shared fixtures. Choose a constrained generator or
handwritten idiomatic decoders with automated conformance tests there, against
the final v2 contract rather than generating a production v1 client now.
