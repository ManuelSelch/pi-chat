import { glob, readFile } from 'node:fs/promises';

export const workspaceRoot = new URL('../', import.meta.url);

export function orderPlugins(plugins) {
  const byName = new Map();
  for (const plugin of plugins) {
    if (byName.has(plugin.manifest.name)) throw new Error(`Duplicate plugin name: ${plugin.manifest.name}`);
    byName.set(plugin.manifest.name, plugin);
  }
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();
  function visit(plugin) {
    const { name, dependencies, devDependencies, peerDependencies, optionalDependencies } = plugin.manifest;
    if (visiting.has(name)) throw new Error(`Plugin dependency cycle: ${name}`);
    if (visited.has(name)) return;
    visiting.add(name);
    for (const dependency of Object.keys({ ...dependencies, ...devDependencies, ...peerDependencies, ...optionalDependencies }).sort()) {
      if (byName.has(dependency)) visit(byName.get(dependency));
    }
    visiting.delete(name);
    visited.add(name);
    ordered.push(plugin);
  }
  for (const plugin of [...plugins].sort((a, b) => a.directory.localeCompare(b.directory))) visit(plugin);
  return ordered;
}

export async function pluginWorkspaces(root = workspaceRoot) {
  const plugins = [];
  for await (const path of glob('plugins/*/package.json', { cwd: root })) {
    const manifest = JSON.parse(await readFile(new URL(path, root), 'utf8'));
    plugins.push({ directory: path.replaceAll('\\', '/').replace(/\/package\.json$/, ''), manifest });
  }
  return orderPlugins(plugins);
}
