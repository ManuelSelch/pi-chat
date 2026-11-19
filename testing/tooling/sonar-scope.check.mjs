import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Sonar excludes test infrastructure from production analysis without excluding application coverage', () => {
  const config = readFileSync('sonar-project.properties', 'utf8');
  const value = key => config.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.split(',') ?? [];
  const exclusions = value('sonar.exclusions');
  assert.ok(exclusions.includes('testing/**'));
  assert.ok(exclusions.includes('**/__test__/**'));
  assert.ok(!value('sonar.coverage.exclusions').some(pattern => pattern.startsWith('src/')));
  assert.ok(!config.includes('sonar.test.inclusions='));
});
