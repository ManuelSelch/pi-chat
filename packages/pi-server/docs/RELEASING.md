# Publishing Pi Server

Releases are manual. Preparing or merging release files does not publish a package, create a tag or restart a running server.

## Verify

Use Node 24 with its paired npm CLI, from a clean checkout of the intended release commit:

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run test:coverage
npm run verify:package
npm audit --omit=dev
npm pack --dry-run
```

Review audit findings before publishing; do not apply unverified dependency upgrades. Keep the tested Pi family pins intact unless a separately verified update is intended.

Confirm that:

- `package.json` and the lockfile agree on the release version (initial release: `0.1.0`).
- The package is public, declares `MIT`, and includes `LICENSE`, `README.md`, the linked public documentation, compiled JS and declarations.
- No credentials, runtime state, source tests, coverage or local vendor artifacts appear in the tarball. Runtime dependencies, including the SDK, resolve from npm rather than sibling checkouts.
- The installed-tarball verification passes, not just source tests; CI is green on the release commit.
- You control the npm scope and the Pi Server copyright being licensed. Preserve third-party licenses. The MIT grant applies to this repository's code, not a blanket relicensing of Pi Chat or dependencies.

## SDK dependency

The SDK is a normal registry dependency, currently pinned to published 0.2.0. Do not bundle locally installed SDK contents or restore temporary vendor archives. `verify:package` checks registry resolution/integrity, absence of SDK files in the server tarball, and shared SDK resolution in an installed consumer. Published server 0.2.0 still contains the old bundled SDK; this source fix requires a new server release version before publication. Preparing the fix does not authorize publication or update consumer pins.

## Publish (explicit maintainer action)

Authenticate with an npm account authorized for `@manuelselch`, with npm's required publishing authentication/2FA. Check package availability before publishing; an existing version cannot be overwritten.

```sh
npm whoami --registry=https://registry.npmjs.org/
npm publish --dry-run
npm publish --access public
```

`prepack` compiles the package for publication. The package's `publishConfig` targets the public npm registry. Do not bypass verification or publish from a dirty worktree.

After a successful publish, confirm the registry's version, license and integrity, then tag the exact verified commit and push only with approval:

```sh
npm view @manuelselch/pi-server@0.1.0 version license dist.integrity
git tag -a v0.1.0 -m "Release 0.1.0"
git push origin main v0.1.0
```

Create matching GitHub release notes describing the local-only security boundary, public APIs, Node requirement and POSIX restart limitation. Update Pi Chat or other consumers separately; publication does not roll out a live server.
