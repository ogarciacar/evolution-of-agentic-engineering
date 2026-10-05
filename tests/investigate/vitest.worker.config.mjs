import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './tests/investigate/wrangler.jsonc' }, miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations('./migrations') } } })],
  test: { include: ['tests/investigate/*.worker.test.mjs'] },
});
