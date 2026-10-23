import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CliDriver } from './cli-driver.mjs';

async function scenario(run) {
  const directory = await mkdtemp(join(tmpdir(), 'pi server cli '));
  const driver = new CliDriver(directory);
  try { await run(driver, directory); }
  finally { await driver.close(); await rm(directory, { recursive: true, force: true }); }
}
test('compiled CLI starts headless, writes PID/logs, and stops on SIGTERM', () => scenario(async driver => {
  await driver.start(); await driver.assertHeadless(); await driver.assertPidAndLog();
}));
test('explicit static directory supports SPA fallback and SIGINT', () => scenario(async (driver, directory) => {
  const assets = join(directory, 'assets'); await mkdir(assets); await writeFile(join(assets, 'index.html'), 'explicit assets');
  await driver.start(['--static-directory', assets]); await driver.assertStatic('explicit assets'); await driver.close('SIGINT');
}));
test('installed-style CLI restarts without a package.json or npm build and rewrites PID', () => scenario(async driver => {
  await driver.start(); await driver.restart(); await driver.assertHeadless();
}));
test('supervised CLI does not advertise restart', () => scenario(async driver => {
  await driver.start(['--no-restart']); await driver.assertRestartDisabled();
}));
test('relative project/static flags retain their meaning across restart, including spaces', () => scenario(async (driver, directory) => {
  await mkdir(join(directory, 'workspace')); await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'assets/index.html'), 'relative assets');
  await driver.start(['--project', 'workspace', '--static-directory', 'assets']);
  await driver.assertStatic('relative assets'); await driver.restart(); await driver.assertStatic('relative assets');
}));
test('CLI rejects invalid port, unknown flags and missing values before listening', () => {
  for (const args of [['--port', 'garbage'], ['--port', '-1'], ['--port', '65536'], ['--unknown'], ['--static-directory']]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../dist/cli.js', import.meta.url)), ...args], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 1, JSON.stringify(args) + result.stderr);
    assert.doesNotMatch(result.stdout, /Pi Server:/);
  }
});
