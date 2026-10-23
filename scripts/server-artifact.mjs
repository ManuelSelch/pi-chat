import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function verifyServerArtifact(root = new URL('../', import.meta.url)) {
  const record = JSON.parse(readFileSync(new URL('vendor/server-artifact.json', root), 'utf8'));
  assert.equal(record.repository, 'pi-server');
  assert.match(record.version, /^\d+\.\d+\.\d+$/);
  for (const revision of [record.revision, record.sourceRevision]) assert.match(revision, /^[0-9a-f]{40}$/);
  assert.match(record.artifact, /^[a-zA-Z0-9._-]+$/, 'Unsafe artifact path');
  const bytes = readFileSync(new URL(`vendor/${record.artifact}`, root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256, 'Server artifact checksum mismatch');
  return record;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyServerArtifact();
  const { createPiServer } = await import('@manuelselch/pi-server');
  assert.equal(typeof createPiServer, 'function');
  console.log('Verified pinned server artifact and public package API.');
}
