/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // The token is a dev-only convenience. Vite inlines VITE_ vars at build
  // time, so without this guard a local `npm run build` with .env present
  // would bake the token into the bundle. Production builds always use
  // the anonymous REST source instead.
  define: command === 'build' ? { 'import.meta.env.VITE_GITHUB_TOKEN': 'undefined' } : {},
  test: {
    // Pure logic tests only (lib and data mapping), so no DOM environment is needed.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
