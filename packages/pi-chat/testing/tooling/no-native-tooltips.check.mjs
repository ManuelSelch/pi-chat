import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';

test('rejects native tooltip titles while allowing meaningful component titles', async () => {
  const eslint = new ESLint();
  const [result] = await eslint.lintText(`
    const example = <><div title="tip" /><span title="tip" /><Text title="tip" /><Modal title="Heading" /><iframe title="Preview" /></>;
  `, { filePath: 'src/web/tooltip-rule.tsx' });

  assert.equal(result.messages.filter(message => message.ruleId === 'no-restricted-syntax').length, 3);
});
