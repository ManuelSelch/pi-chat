import tseslint from 'typescript-eslint';

export default [
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'coverage-e2e/**', 'test-results/**', 'mockups/**', 'vendor/**', 'packages/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXOpeningElement[name.name=/^(?!iframe$)[a-z]/] > JSXAttribute[name.name="title"], JSXOpeningElement[name.name=/^(Text|ActionIcon|UnstyledButton|Box)$/] > JSXAttribute[name.name="title"]',
          message: 'Do not use title attributes for native tooltips.',
        },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'variable', format: ['camelCase', 'PascalCase', 'UPPER_CASE'], leadingUnderscore: 'allowDouble', trailingUnderscore: 'allowDouble' },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'parameter', modifiers: ['destructured'], format: null },
        { selector: 'classMethod', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'typeMethod', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'objectLiteralMethod', format: ['camelCase', 'PascalCase'] },
        { selector: 'property', format: ['camelCase'], leadingUnderscore: 'allowDouble' },
        { selector: 'objectLiteralProperty', format: ['camelCase', 'UPPER_CASE'], leadingUnderscore: 'allowDouble', trailingUnderscore: 'allowDouble' },
        { selector: 'classProperty', modifiers: ['static'], format: ['camelCase', 'UPPER_CASE'] },
        { selector: 'objectLiteralProperty', modifiers: ['requiresQuotes'], format: null },
        { selector: 'objectLiteralProperty', filter: { regex: '^(file_path|npm_execpath)$', match: true }, format: null },
        { selector: 'property', modifiers: ['requiresQuotes'], format: null },
        { selector: 'property', filter: { regex: '^(file_path|npm_execpath)$', match: true }, format: null },
      ],
    },
  },
];
