import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './tests/investigate/wrangler.jsonc' } })],
  test: { include: ['tests/investigate/*.worker.test.mjs'] },
});
