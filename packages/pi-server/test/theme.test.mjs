import { test } from 'node:test';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = await realpath(await mkdtemp(join(tmpdir(), 'pi-theme-package-')));
process.env.PI_CODING_AGENT_DIR = join(directory, 'global-agent');
const { ThemeDriver } = await import('./theme-driver.mjs');
try {
  await test('headless custom theme reaches open/create and widgets, isolates runtimes, and stays cached on open/reload', async () => {
    await ThemeDriver.run(directory, async theme => {
      await theme.createCustomSession();
      await theme.shouldIsolateRuntimePalettes();
      await theme.shouldReuseCachedThemeOnOpenAndReload();
      await theme.shouldKeepThemesOutOfOtherPayloads();
      await theme.shouldOpenWithFallbackForInvalidSelection();
    });
  });
} finally { await rm(directory, { recursive: true, force: true }); }
