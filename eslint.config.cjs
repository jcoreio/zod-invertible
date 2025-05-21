const { defineConfig } = require('eslint/config')

module.exports = defineConfig([
  ...require('@jcoreio/toolchain/eslintConfig.cjs'),
])
