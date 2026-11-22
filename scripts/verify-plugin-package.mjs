import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export function verifyPluginArtifact(manifest, artifact) {
  function checkEntry(entry) {
    if (typeof entry === 'string') {
      assert.ok(entry.startsWith('./dist/'), `Plugin export must be compiled: ${entry}`);
      assert.ok(artifact.files.some(file => file.path === entry.slice(2)), `Missing plugin export: ${entry}`);
    } else {
      assert.ok(entry && typeof entry === 'object', 'Plugin exports must declare compiled entries');
      for (const condition of Object.values(entry)) checkEntry(condition);
    }
  }
  assert.ok(manifest.exports, 'Plugin must declare public exports');
  checkEntry(manifest.exports);
  for (const file of artifact.files)
    assert.doesNotMatch(file.path, /(^src\/|__tests__|\.test\.)/);
}

export async function verifyPluginPackage() {
  assert.ok(process.env.npm_execpath, 'Run through npm run verify:package');
  const manifest = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
  const [artifact] = JSON.parse(execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--dry-run', '--ignore-scripts', '--json'], { encoding: 'utf8' }));
  verifyPluginArtifact(manifest, artifact);
  return artifact;
}
