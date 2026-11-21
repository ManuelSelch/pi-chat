import assert from 'node:assert/strict';
import { test } from 'node:test';
import { workspaceLcov } from '../../scripts/report-package-coverage.mjs';

test('keeps SDK and Server coverage distinct from Chat source paths', () => {
  for (const workspace of ['packages/pi-sdk-typescript', 'packages/pi-server']) {
    const report = workspaceLcov('SF:src/index.ts\nDA:1,1\nend_of_record\n', workspace, '/repo');
    assert.equal(report, `SF:${workspace}/src/index.ts\nDA:1,1\nend_of_record\n`);
    assert.throws(() => workspaceLcov('SF:../other/src/index.ts', workspace, '/repo'), /outside workspace/);
  }
});
