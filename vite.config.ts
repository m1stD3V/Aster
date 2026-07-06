/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  test: {
    // Pure logic tests only (lib and data mapping), so no DOM environment is needed.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
