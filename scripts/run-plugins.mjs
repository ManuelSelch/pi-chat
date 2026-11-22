import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { pluginWorkspaces, workspaceRoot } from './plugin-workspaces.mjs';

export function pluginArguments(script, plugins) {
  if (!script) throw new Error('A plugin script name is required');
  if (script === 'watch')
    return ['exec', '--', 'concurrently', '-k', ...plugins.map(({ manifest }) =>
      `npm exec --workspace='${manifest.name.replaceAll("'", "'\\''")}' -- tsc -p tsconfig.json --watch`)];
  return ['run', script, ...plugins.flatMap(({ directory }) => ['--workspace', directory])];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const plugins = await pluginWorkspaces();
  if (plugins.length) {
    if (!process.env.npm_execpath) throw new Error('Run plugin scripts through npm');
    const result = spawnSync(process.execPath, [process.env.npm_execpath, ...pluginArguments(process.argv[2], plugins)], {
      cwd: workspaceRoot, stdio: 'inherit',
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
}
