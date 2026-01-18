import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import * as fs from 'fs'
import * as path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest',
      writeBundle() {
        fs.copyFileSync(
          path.resolve(__dirname, 'manifest.json'),
          path.resolve(__dirname, '../dist-extension/manifest.json')
        );
      }
    }
  ],
  root: resolve(__dirname, '../'), // Function as if we are in root
  publicDir: resolve(__dirname, '../public'), // Use regular public dir
  base: './', // Relative paths for extension
  build: {
    outDir: 'dist-extension',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'background.ts'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "../src"),
    },
  },
})
