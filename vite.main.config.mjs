import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        globals: {
          'electron-settings': 'electronSettings'
        }
      }
    }
  }
});
