import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    fs: {
      allow: ['..']
    }
  },
  optimizeDeps: {
    exclude: ['geo-buffer-wasm']
  }
})