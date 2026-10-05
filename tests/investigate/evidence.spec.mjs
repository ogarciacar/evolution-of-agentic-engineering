import { test, expect } from '@playwright/test';
import { handleRequest } from '../../workers/ai-search/index.js';

const passage = '  ## What this does not establish\n' + 'This is an EAE interpretation, not a causal measurement. '.repeat(20) + '\n<script>window.injected=true</script>  ';
const chunks = [
  { item: { key: '/signals/context/', metadata: { title: 'Context evidence' } }, text: passage },
  { item: { key: '/signals/context/' }, text: 'A second passage with a different observation.' },
];
async function setup(page, sourceChunks = chunks, metadata = true) {
  await page.route('**/api/search?*', async route => {
    const response = await handleRequest(new Request(route.request().url()), { AI_SEARCH: { get: () => ({ search: async () => ({ chunks: sourceChunks }) }) } });
    await route.fulfill({ status: response.status, json: await response.json() });
  });
  await page.route('**/api/evidence/**', route => route.fulfill(metadata ? { json: {
    id: 'context', source: { title: 'Original engineering report', producer: 'Example Engineering', date: '2026-09-01', url: 'https://example.com/report' },
    presentation: { headline: 'Context evidence' },
  } } : { status: 503 }));
  await page.goto('/');
  await page.locator('#ask-evidence-input').fill('What does the evidence establish?');
  await page.getByRole('button', { name: 'Investigate', exact: true }).click();
}

test('T11/T12: inspect full passages, distinguish provenance, and return by keyboard', async ({ page }) => {
  await setup(page);
  const inspect = page.getByRole('button', { name: 'Inspect passages', exact: true });
  await inspect.click();
  const dialog = page.getByRole('dialog', { name: 'Retrieved evidence' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Passages from the indexed EAE page. These may include EAE interpretation and are not verified quotations from the original source.')).toBeVisible();
  expect(await dialog.locator('.evidence-passage').first().textContent()).toBe(passage);
  await expect(dialog.locator('.evidence-passage')).toHaveCount(2);
  await expect(dialog.getByRole('link', { name: 'Open original source' })).toHaveAttribute('href', 'https://example.com/report');
  await expect(dialog).toContainText('Example Engineering');
  await expect(dialog).toContainText('September 1, 2026');
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeInViewport({ ratio: 1 });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(inspect).toBeFocused();
});

test('T05/T10: no match is explicit and refinement preserves the question without submitting', async ({ page }) => {
  await setup(page, []);
  await expect(page.getByRole('heading', { name: 'No matching evidence in this corpus' })).toBeVisible();
  await expect(page.getByText('This does not establish that evidence does not exist elsewhere. Try a narrower question or name a practice or organisation.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inspect passages' })).toHaveCount(0);
  let requests = 0;
  page.on('request', req => { if (req.url().includes('/api/search?')) requests++; });
  await page.getByRole('button', { name: 'Refine question', exact: true }).click();
  await expect(page.locator('#ask-evidence-input')).toBeFocused();
  await expect(page.locator('#ask-evidence-input')).toHaveValue('What does the evidence establish?');
  await expect(page.getByRole('heading', { name: 'No matching evidence in this corpus' })).not.toBeVisible();
  expect(requests).toBe(0);
});

test('missing original metadata keeps exact passages inspectable without invented attribution', async ({ page }) => {
  await setup(page, chunks, false);
  await page.getByRole('button', { name: 'Inspect passages' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Original-source metadata is unavailable. Use the EAE page to check its references.')).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Open original source' })).toHaveCount(0);
  await expect(dialog.getByRole('link', { name: 'Open EAE page' })).toHaveAttribute('href', 'https://agenticengineering.science/signals/context/');
});

test('retrieval failure is never presented as no evidence', async ({ page }) => {
  await page.route('**/api/search?*', route => route.fulfill({ status: 503 }));
  await page.goto('/');
  await page.locator('#ask-evidence-input').fill('Context?');
  await page.getByRole('button', { name: 'Investigate', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Search is temporarily unavailable');
  await expect(page.getByRole('heading', { name: 'No matching evidence in this corpus' })).toHaveCount(0);
});
