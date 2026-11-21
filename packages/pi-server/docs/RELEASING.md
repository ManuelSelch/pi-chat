# Package releases

- SDK and Server remain separately packable packages in the Pi Chat workspace.
- Install once at the monorepo root: `npm ci --ignore-scripts`.
- Run the complete root Pi pipeline, including `verify:packages` and `verify:protocol`.
- `verify:packages` builds SDK → Server and tests both tarballs in isolated consumers, without workspace links or frontend dependencies.
- Update dependency versions together when contracts change. The Server manifest retains a normal exact SDK version, not a workspace-only dependency specifier.
- Publish the matching SDK before Server when needed. Unpublished candidate versions require supplying both tarballs explicitly; local package verification does not prove registry availability.
- Inspect `npm pack --dry-run -w @manuelselch/pi-server` and the equivalent SDK command before release. No credentials, runtime state, tests, coverage, sources or bundled SDK belong in Server's artifact.
- Preserve package licenses and third-party notices.
- Publication, pushes and consumer dependency updates require explicit authorization. This migration does none of them.
