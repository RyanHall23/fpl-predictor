import js from '@eslint/js';
import pluginJs from '@eslint/js';
import pluginReact from 'eslint-plugin-react';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.venv/**',
      '**/coverage/**'
    ]
  },
  {
    files: [
      '**/*.{js,mjs,cjs,jsx}'
    ]
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  pluginJs.configs.recommended,
  pluginReact.configs.flat.recommended,
  js.configs.recommended,
  {
    plugins: {
      react: pluginReact
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'warn',
      'react/jsx-curly-spacing': [
        'error',
        {
          when: 'always',
          children: true
        }
      ],
      'object-curly-spacing': ['error', 'always'],
      'quotes': ['error', 'single'],
      'jsx-quotes': ['error', 'prefer-single'],
      'eol-last': ['error', 'always']
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  }
];
