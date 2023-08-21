module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true
  },
  extends: 'standard',
  overrides: [
    {
      env: {
        node: true
      },
      files: [
        '.eslintrc.{js,cjs}'
      ],
      parserOptions: {
        sourceType: 'script'
      }
    }
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    // CodeBiting rules

    // Use 2 space identation to get the code more compact
    // In switch-case ident case https://eslint.org/docs/latest/rules/indent#switchcase
    indent: ['error', 4, { "SwitchCase": 1 }],
    // Use semicolons to make the code easier to read
    semi: ['error', 'always']
  }
}
