import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

function files(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

test('uses Bulletproof React folders and colocated module tests', () => {
  for (const feature of ['chat', 'extensions', 'sessions', 'settings'])
    assert.ok(existsSync(`src/web/features/${feature}`), `missing feature: ${feature}`);

  for (const legacy of ['test', 'src/web/ui', 'src/web/chat', 'src/web/sessions', 'src/web/settings', 'src/web/extensions'])
    assert.ok(!existsSync(legacy), `legacy folder: ${legacy}`);

  for (const path of files('src')) {
    assert.ok(!path.split('/').includes('domain'), `domain folder: ${path}`);
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path))
      assert.ok(path.includes('/__test__/'), `module test must be colocated: ${path}`);
  }

  for (const owner of ['src/host', 'src/shared', 'extension', 'src/web/features/chat/composer'])
    assert.ok(existsSync(`${owner}/__test__`), `missing module tests: ${owner}`);
});
