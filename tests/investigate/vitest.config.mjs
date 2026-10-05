import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/investigate/*.unit.test.mjs'] } });
