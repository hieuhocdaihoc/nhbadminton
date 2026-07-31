import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Cac trang hien tai dung effect de tai du lieu tu API khi mount/thay bo loc.
      'react-hooks/set-state-in-effect': 'off',
      // React 19 khong can bien React trong JSX; ten catch duoc giu de de debug.
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^(React|Fragment)$',
        caughtErrors: 'none',
      }],
    },
  },
])
