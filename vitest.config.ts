import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  // `server-only` throws outside the React server build; tests run server modules directly.
  'server-only': fileURLToPath(new URL('./tests/server-only-stub.ts', import.meta.url)),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.{ts,tsx}'], environment: 'node' } },
      { extends: true, test: { name: 'perm', include: ['tests/perm/**/*.test.ts'], environment: 'node' } },
    ],
  },
});
