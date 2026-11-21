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
  for (const workspace of ['packages/pi-sdk-typescript', 'packages/pi-server']) {
    const report = await readFile(resolve(root, workspace, 'coverage/lcov.info'), 'utf8');
    reports.push(workspaceLcov(report, workspace, root));
  }
  await mkdir(resolve(root, 'coverage-packages'), { recursive: true });
  await writeFile(resolve(root, 'coverage-packages/lcov.info'), reports.join('\n'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await collectPackageCoverage();
