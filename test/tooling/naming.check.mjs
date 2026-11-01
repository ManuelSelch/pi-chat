import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESLint } from 'eslint';

const eslint = new ESLint();
async function rules(code) {
  const [result] = await eslint.lintText(code, { filePath: 'test/example.ts' });
  return result.messages.map((message) => message.ruleId ?? message.message);
}

test('enforces camelCase for driver methods and properties', async () => {
  assert.deepEqual(await rules('class Driver { Settings = 1; Open() {} }'), [
    '@typescript-eslint/naming-convention', '@typescript-eslint/naming-convention',
  ]);
  assert.deepEqual(await rules('class Driver { settings = 1; open() {} }'), []);
  assert.deepEqual(await rules('interface User { display_name: string; Open(): void }'), [
    '@typescript-eslint/naming-convention', '@typescript-eslint/naming-convention',
  ]);
});

test('enforces camelCase for variables and preserves constants and wire keys', async () => {
  assert.deepEqual(await rules('let user_name = 1;'), ['@typescript-eslint/naming-convention']);
  assert.deepEqual(await rules('const MAX_SIZE = 1; const userName = { "file_path": 1 };'), []);
});
