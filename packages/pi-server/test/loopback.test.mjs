import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LoopbackDriver } from './loopback-driver.mjs';

async function scenario(run) {
  const directory = await mkdtemp(join(tmpdir(), 'pi-server-loopback-'));
  const driver = new LoopbackDriver(directory);
  try { await run(driver, directory); }
  finally { await driver.cleanup(); await rm(directory, { recursive: true, force: true }); }
}
test('compiled fixture preserves streaming/Stop, disconnect retention and explicit shutdown close', () => scenario(async driver => {
  await driver.start(); await driver.exerciseRetainedStreaming();
  assert.deepEqual(await driver.stop(), { created: 1, retained: 1, closed: 1 });
}));
test('compiled fixture rejects caller-selected project paths', () => scenario(async driver => {
  await driver.start(); await driver.rejectCallerPath();
  assert.deepEqual(await driver.stop(), { created: 0, retained: 0, closed: 0 });
}));
test('compiled fixture rejects arguments before creating caller-selected files', () => scenario(async driver => {
  await driver.start(['untrusted']); await driver.assertRejectedArguments();
}));
