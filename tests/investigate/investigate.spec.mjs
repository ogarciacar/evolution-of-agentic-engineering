import { test, expect } from '@playwright/test';

const question = 'What makes context useful to coding agents?';
const fixture = {
  results: [{
    title: 'Context evidence fixture',
    url: 'https://agenticengineering.science/signals/context-fixture/',
    excerpt: 'A fixed passage for testing the investigation interaction.',
  }],
};

test.beforeEach(async ({ page }) => {
  // No live AI or evidence services in acceptance tests.
  await page.route('**/api/evidence/**', route => route.fulfill({ status: 404 }));
  await page.goto('/');
});

test('T00/T02/T07: submit once, retain the question, and stop by keyboard', async ({ page }) => {
  let requests = 0;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/search?*', async route => {
    requests++;
    await pending;
    await route.fulfill({ json: fixture }).catch(() => {});
  });
  const input = page.getByLabel('What are you trying to understand?', { exact: true });
  const submit = page.getByRole('button', { name: 'Investigate', exact: true });
  const stop = page.getByRole('button', { name: 'Stop', exact: true });
  try {
    await expect(stop).toBeHidden();
    await input.fill(question);
    await input.press('Enter');
    await expect(page.getByRole('status')).toHaveText('Finding relevant evidence…');
    await expect(input).toHaveValue(question);
    await expect(submit).toBeDisabled();
    await expect(stop).toBeVisible();
    await expect(stop).toBeInViewport({ ratio: 1 });
    // Repeated submit events and example clicks must not start another request.
    await page.locator('#ask-evidence-form').evaluate(form => form.requestSubmit());
    await page.locator('[data-question]').first().click();
    await expect(input).toHaveValue(question);
    await expect.poll(() => requests).toBe(1);
    await stop.focus();
    await page.keyboard.press('Enter');
    await expect(input).toBeFocused();
    await expect(submit).toBeEnabled();
    await expect(stop).toBeHidden();
    await expect(input).toHaveValue(question);
    await expect(page.getByRole('status')).toHaveText('Investigation stopped. You can edit your question and try again.');
    await expect(page.locator('#ask-evidence-results')).toBeEmpty();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    release();
  }
});

test('T01: empty, whitespace and over-limit questions show an error without a request', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/search?*', route => { requests++; return route.fulfill({ json: fixture }); });
  const input = page.getByLabel('What are you trying to understand?', { exact: true });
  for (const value of ['', '   ', 'x'.repeat(501)]) {
    await input.evaluate((el, text) => { el.value = text; }, value);
    await page.getByRole('button', { name: 'Investigate', exact: true }).click();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('alert')).toHaveText(value.length > 500
      ? 'Use 500 characters or fewer.' : 'Enter a question to search the evidence.');
    await expect(input).toBeFocused();
  }
  expect(requests).toBe(0);
  await input.fill(question);
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#ask-evidence-error')).toBeEmpty();
});

test('a completed request still renders existing evidence cards', async ({ page }) => {
  await page.route('**/api/search?*', route => route.fulfill({ json: fixture }));
  await page.getByLabel('What are you trying to understand?', { exact: true }).fill(question);
  await page.getByRole('button', { name: 'Investigate', exact: true }).click();
  await expect(page.getByRole('heading', { name: fixture.results[0].title })).toBeVisible();
  await expect(page.locator('#ask-evidence-count')).toHaveText('1 result');
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Investigate', exact: true })).toBeEnabled();
});

test('a service error preserves the question and allows another submission', async ({ page }) => {
  await page.route('**/api/search?*', route => route.fulfill({ status: 503 }));
  const input = page.getByLabel('What are you trying to understand?', { exact: true });
  await input.fill(question);
  await page.getByRole('button', { name: 'Investigate', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Search is temporarily unavailable');
  await expect(input).toHaveValue(question);
  await expect(page.getByRole('button', { name: 'Investigate', exact: true })).toBeEnabled();
});

for (const outcome of ['success', 'failure']) {
  test(`T07: late ${outcome} cannot overwrite a newer completed investigation`, async ({ page }) => {
    // Model a provider that ignores abort; this must still be safe for the UI.
    await page.addInitScript(() => {
      const realFetch = window.fetch.bind(window);
      let first = true;
      window.fetch = (url, options) => {
        if (String(url).startsWith('/api/search?') && first) {
          first = false;
          return new Promise((resolve, reject) => {
            window.settleOldSearch = (fail, data) => fail
              ? reject(new Error('Late failure'))
              : resolve(new Response(JSON.stringify(data), { status: 200 }));
          });
        }
        return realFetch(url, options);
      };
    });
    await page.reload();
    await page.route('**/api/search?*', route => route.fulfill({ json: fixture }));
    const input = page.getByLabel('What are you trying to understand?', { exact: true });
    const submit = page.getByRole('button', { name: 'Investigate', exact: true });
    await input.fill('Old question');
    await submit.click();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await input.fill('New question');
    await submit.click();
    await expect(page.getByRole('heading', { name: fixture.results[0].title })).toBeVisible();
    await page.evaluate(async ({ fail, data }) => {
      window.settleOldSearch(fail, data);
      await new Promise(requestAnimationFrame);
    }, { fail: outcome === 'failure', data: { results: [] } });
    await expect(page.getByRole('heading', { name: fixture.results[0].title })).toBeVisible();
    await expect(page.getByRole('status')).toBeEmpty();
    await expect(input).toHaveValue('New question');
    await expect(submit).toBeEnabled();
  });
}
