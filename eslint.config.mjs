import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginReact from 'eslint-plugin-react';
import js from '@eslint/js';

export default [
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
      ]
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  }
];