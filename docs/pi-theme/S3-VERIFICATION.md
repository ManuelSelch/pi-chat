# Pi theme — S3 verification

## Delivered
- Independent server commit `b44ecdc6e4462b6171312298cf5f1955dac7ec9b` in [pi-server](/Users/manuelselch/Documents/A_Personal/40%20Projekte/47%20Agents/Pi%20Agent/pi-server). See its [full verification record](/Users/manuelselch/Documents/A_Personal/40%20Projekte/47%20Agents/Pi%20Agent/pi-server/docs/pi-theme/S3-VERIFICATION.md).
- Runtime-owned truecolor Pi theme, bound before extension startup and re-resolved on runtime replacement. Resolve only runtime-discovered resources and installed built-ins. Read effective `getThemeSetting()` because Pi's `getTheme()` discards light/dark pairs; use their dark member.
- Validate custom documents with Pi; actual theme colors use Pi's loader/color primitives. The user approved the small attributed export-only variable/surface adapter after discovering that Pi's relevant helpers were private/global-state-dependent.
- Missing, invalid, unavailable, system and terminal-default selections return deterministic Pi dark with a sanitized server diagnostic.
- Required cached palette only in open/create results, including opening an already-running runtime. Same instance colors widgets; reload retains both instance and palette. Snapshots, initialization and events remain theme-free. Injected server RuntimeAdapter implementations now require `sessionTheme()`.
- Server temporarily pins/bundles verified SDK S2 artifact `661fecd8b7920d3d8560b625d687f6fa666f15f3`, with archive/hash receipt and installed-consumer verification. Published SDK/server versions and Chat's dependency/lockfiles remain unchanged.

## Executed verification
- Red/green: resolver cases, reload caching and real-Pi pair selection regression reproduced before implementation/fixes.
- Fresh isolated source export: `npm ci --ignore-scripts`, typecheck, **450 unit tests / 61 files** with coverage (**86.02% lines**), **17 compiled-package scenarios**, and **17 installed packed-consumer scenarios**, including public TypeScript declaration checks.
- Coverage includes custom variables/RGB/indexed/OKLCH/OKHSL, export parity and surface derivation, resource-list boundaries, deterministic fallbacks, two runtime palettes, startup/replacement binding, existing open, reload with changed/invalid source, same-server reconnect and payload placement. A real extension's ANSI/bold widget crosses the public server/socket/SDK boundary without a TTY or model prompt.
- `git diff --check` passed. Existing server audit findings remain **4 moderate + 1 high**; no unverified audit fix.

## Remaining scope
- S4: consume verified artifacts in Chat, integrate Mantine and verify browser behavior. No production Chat UI/dependency changes were made in S3.
- No project push, publication/version bump, live-server restart, remote CI/Sonar run or Swift/live-model verification. Do not publish the temporary bundled-SDK checkout as-is; the server release documentation records the required registry-pin restoration.
