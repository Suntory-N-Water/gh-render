import path from 'node:path';
import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    sourcemapIgnoreList: (sourcePath) => sourcePath.includes('node_modules'),
  },
  test: {
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    env: { AGENT: '1' },
    setupFiles: ['./test/apply-migrations.ts'],
  },
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(
        path.join(__dirname, 'drizzle/migrations'),
      );
      return {
        wrangler: { configPath: './wrangler.test.jsonc' },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      };
    }),
  ],
});
