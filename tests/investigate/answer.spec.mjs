import { test, expect } from '@playwright/test';
import { handleRequest } from '../../workers/ai-search/index.js';
import { fixtureEnv, answerFor, record } from './answer-fixtures.mjs';
async function setup(page, mode = 'answer') {
  let calls = 0;
  await page.route('**/api/search?*', async route => {
    const response = await handleRequest(new Request(route.request().url()), { ...fixtureEnv(), AI_SEARCH: { get: () => ({ search: async () => ({ chunks: [{ item: { key: '/signals/context/', metadata: { title: 'Context evidence' } }, text: 'Older indexed passage.' }] }) }) } });
    await route.fulfill({ status: response.status, json: await response.json() });
  });
  await page.route('**/api/evidence/**', route => route.fulfill({ json: record }));
  await page.route('**/api/search/answer', async route => {
    calls++;
    if (mode === 'retry' && calls === 1) return route.fulfill({ status: 503 });
    if (mode === 'wait') return;
    const env = fixtureEnv(mode === 'limited' ? async () => ({ response: { outcome: 'insufficient', summary: { text: 'These records cannot establish a cycle-time improvement.', citations: [] }, claims: [], uncertainties: ['Need a comparable cycle-time measurement.'], next_step: null } }) : undefined);
    const response = await handleRequest(new Request(route.request().url(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: route.request().postData() }), env);
    await route.fulfill({ status: response.status, json: await response.json() });
  });
  await page.goto('/');
  await page.locator('#ask-evidence-input').fill('Where should we focus?');
  await page.getByRole('button', { name: 'Investigate', exact: true }).click();
}
test('T03/T04/T11/T12: read a bounded answer and inspect its current canonical citation', async ({ page }) => {
  await setup(page);
  const answer = page.locator('#ask-evidence-answer');
  await expect(answer.getByRole('heading', { name: 'What the evidence suggests' })).toBeVisible();
  await expect(answer).toContainText('AI interpretation');
  await expect(answer.getByRole('heading', { name: 'One next step' })).toBeVisible();
  await expect(answer).toContainText('Record unnecessary exploration calls');
  const citation = answer.getByRole('button', { name: 'Inspect citation 1' }).first();
  await citation.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(record.observed[0]);
  await expect(dialog).toContainText('Current EAE record');
  await expect(dialog).toContainText(record.what_this_does_not_establish[0]);
  await expect(dialog).not.toContainText('Older indexed passage');
  await page.keyboard.press('Escape');
  await expect(citation).toBeFocused();
  expect(await answer.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});
test('T05/T10: insufficient evidence explains what is missing and keeps evidence accessible', async ({ page }) => {
  await setup(page, 'limited');
  const answer = page.locator('#ask-evidence-answer');
  await expect(answer).toContainText('Not enough evidence to answer');
  await expect(answer).toContainText('Need a comparable cycle-time measurement.');
  await expect(page.getByRole('button', { name: 'Inspect passages', exact: true })).toBeVisible();
  await answer.getByRole('button', { name: 'Refine question' }).click();
  await expect(page.locator('#ask-evidence-input')).toBeFocused();
  await expect(page.locator('#ask-evidence-input')).toHaveValue('Where should we focus?');
});
test('T06/T08: answer failure preserves evidence and offers an explicit retry', async ({ page }) => {
  await setup(page, 'retry');
  await expect(page.getByRole('button', { name: 'Inspect passages', exact: true })).toBeVisible();
  await expect(page.locator('#ask-evidence-answer')).toContainText('The answer could not be prepared');
  await page.getByRole('button', { name: 'Retry answer' }).click();
  await expect(page.getByRole('heading', { name: 'What the evidence suggests' })).toBeVisible();
});
test('T07: stop during preparation retains question and removes the working state', async ({ page }) => {
  await setup(page, 'wait');
  await expect(page.getByRole('status')).toContainText('Preparing an answer');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('#ask-evidence-input')).toBeEditable();
  await expect(page.locator('#ask-evidence-input')).toHaveValue('Where should we focus?');
  await expect(page.locator('#ask-evidence-answer')).toBeEmpty();
});
test('T14: copy includes sources and uncertainties', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await setup(page);
  await page.getByRole('button', { name: 'Copy answer with sources' }).click();
  await expect(page.locator('[data-copy-status]')).toContainText('Copied with sources and uncertainties.');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('Where should we focus?');
  expect(text).toContain('Record snapshot:');
  expect(text).toContain('https://example.com/report');
  expect(text).toContain('not a causal comparison');
});
