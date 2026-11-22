import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { relative, resolve, isAbsolute } from 'node:path';

export function workspaceLcov(report, workspace, root) {
  const directory = resolve(root, workspace);
  return report.replace(/^SF:(.+)$/gm, (_line, source) => {
    const absolute = isAbsolute(source) ? source : resolve(directory, source);
    const local = relative(directory, absolute).replaceAll('\\', '/');
    if (!local.startsWith('src/') || local.includes('/../')) throw new Error(`Coverage outside workspace source: ${source}`);
    return `SF:${workspace}/${local}`;
  });
}

export async function collectPackageCoverage() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const reports = [];
  for (const workspace of ['packages/pi-sdk-typescript', 'plugins/file-opening', 'plugins/folder-opening', 'packages/pi-server']) {
    const report = await readFile(resolve(root, workspace, 'coverage/lcov.info'), 'utf8');
    reports.push(workspaceLcov(report, workspace, root));
  }
  await mkdir(resolve(root, 'coverage-packages'), { recursive: true });
  await writeFile(resolve(root, 'coverage-packages/lcov.info'), reports.join('\n'));
}

export async function collectChatCoverage(kind) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const workspace = 'packages/pi-chat';
  const directory = kind === 'unit' ? 'coverage' : 'coverage-e2e';
  const report = await readFile(resolve(root, workspace, directory, 'lcov.info'), 'utf8');
  await mkdir(resolve(root, directory), { recursive: true });
  await writeFile(resolve(root, directory, 'lcov.info'), workspaceLcov(report, workspace, root));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--chat-unit')) await collectChatCoverage('unit');
  else if (process.argv.includes('--chat-e2e')) await collectChatCoverage('e2e');
  else await collectPackageCoverage();
}
