import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'

export default defineConfig({
  plugins: [
    electron({
      entry: 'src/main.ts',
      onstart: options => {
        // Start Electron App
        options.startup(['.', '--no-sandbox'])
      },
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
