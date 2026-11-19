import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  // electron-vite keeps dependencies external in main and preload by default.
  main: {
    resolve: { alias: { '@shared': resolve('src/shared') } },
  },
  preload: {
    resolve: { alias: { '@shared': resolve('src/shared') } },
    build: { rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } } },
  },
  renderer: {
    root: 'src/renderer',
    resolve: { alias: { '@shared': resolve('src/shared'), '@': resolve('src/renderer/src') } },
    plugins: [react(), tailwindcss()],
    // ES-module workers keep code splitting, so Shiki grammars stay lazy chunks instead of one 9 MB file.
    worker: { format: 'es' },
    // electron-vite leaves output unminified by default; the renderer parses less code at startup when minified.
    build: { minify: true },
  },
})
