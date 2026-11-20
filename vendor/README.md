# Local SDK candidate

- The SDK tarball here is an unpublished candidate, not a registry release.
- The manifest pins its exact version; the lockfile records this archive's relative path and SHA-512 integrity.
- `npm ci --ignore-scripts` installs independently of sibling repositories.
- The server tarball does not bundle the SDK or this directory. Candidate consumers must explicitly install both matching SDK and server archives.
- `verify:package` checks archive integrity, installs both into an isolated consumer, and verifies shared SDK resolution, exports and lifecycle.
- Source and archive checksums are recorded in `candidate.json`; refresh the archive, lock integrity and receipt together.
