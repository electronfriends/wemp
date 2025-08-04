import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'node22',
    lib: {
      entry: 'src/main.js',
      formats: ['es'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: [
        'electron',
        'electron-settings',
        'electron-squirrel-startup',
        'update-electron-app',
      ],
    },
  },
});
