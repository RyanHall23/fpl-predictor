import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      // Allow JSX in .js files
      jsxRuntime: 'automatic',
      babel: {
        presets: [['@babel/preset-react', { runtime: 'automatic' }]]
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  },
  esbuild: {
    loader: 'jsx', // default loader
    include: /src\/.*\.js$/, // apply to all .js files in src
    exclude: [],
  },
})
