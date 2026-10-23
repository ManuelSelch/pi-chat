import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifySDKArtifacts } from './sdk-artifacts.mjs';

assert.equal(process.platform, 'darwin', 'Swift host verification requires macOS/Xcode');
const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.env.npm_execpath;
assert.ok(npm, 'Run through npm run test:server-package:swift');
const sdk = verifySDKArtifacts();
const temporary = mkdtempSync(join(tmpdir(), 'pi-server-packed-swift-'));
const run = (command, args, cwd = temporary, options = {}) => execFileSync(command, args, {
  cwd, timeout: 180000, stdio: 'inherit', ...options,
});
try {
  // S3 can verify an independently checked-out server without changing Chat's runtime dependency.
  const packageRoot = process.argv[2] ? resolve(process.argv[2]) : join(root, 'packages/pi-server');
  run(process.execPath, [npm, 'run', 'build'], packageRoot);
  const packed = JSON.parse(run(process.execPath, [npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', temporary], packageRoot,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }))[0];
  writeFileSync(join(temporary, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: {
    '@manuelselch/pi-server': './' + packed.filename,
  } }));
  run(process.execPath, [npm, 'install', '--ignore-scripts', '--no-audit', '--no-fund']);
  const launcher = join(temporary, 'fixture.mjs');
  writeFileSync(launcher, 'import { runLoopbackFixture } from "@manuelselch/pi-server/testing/loopback"; await runLoopbackFixture();\n');
  const harness = join(temporary, 'swift-integration');
  mkdirSync(join(harness, '.sdk'), { recursive: true });
  cpSync(join(root, 'test/swift-integration/Package.swift'), join(harness, 'Package.swift'));
  cpSync(join(root, 'test/swift-integration/Tests'), join(harness, 'Tests'), { recursive: true });
  const checkout = join(harness, '.sdk/pi-sdk-swift');
  run('git', ['clone', '--quiet', '--no-checkout', join(root, 'vendor', sdk.swift.artifact), checkout]);
  run('git', ['-C', checkout, 'checkout', '--quiet', '--detach', sdk.swift.revision]);
  run('xcrun', ['swift', 'test', '--package-path', checkout], temporary);
  run('xcrun', ['swift', 'test', '--package-path', harness], temporary, {
    env: { ...process.env, NODE_PATH: '', PI_CODING_AGENT_DIR: join(temporary, 'agent'), PI_SWIFT_FIXTURE_ENTRY: launcher },
  });
  console.log('Verified pinned standalone Swift SDK and Chat-owned Swift scenarios against an installed compiled server with no Chat sources or tsx.');
} finally { rmSync(temporary, { recursive: true, force: true }); }
