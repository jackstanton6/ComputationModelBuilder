// Smoke tests against the built site (npm run build first). The local server mimics the
// Worker's static asset handling (trailing slashes, 404 page, /cmb redirect).
import { expect, test } from '@playwright/test';

test('home page renders with its own title and links', async ({ page }) => {
  await page.goto('/cmb/');
  await expect(page).toHaveTitle('Computation Model Builder · FSMs & grammars for MATH1064/1964');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Computation Model Builder');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://jackstanton.dev/cmb/');
  await expect(page.getByText('0 of 70 solved')).toBeVisible();
});

test('/cmb redirects and unknown paths show the 404 page', async ({ page }) => {
  const res = await page.goto('/cmb');
  expect(page.url()).toMatch(/\/cmb\/$/);
  expect(res?.ok()).toBe(true);
  const missing = await page.goto('/cmb/no-such-page/');
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

test('machine builder: add a state, see the partial f, complete with a dead state, run', async ({ page }) => {
  await page.goto('/cmb/machines/');
  const canvas = page.locator('svg.canvas');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  await canvas.dblclick({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.getByText('f(s₀, 0) is undefined', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Complete with a dead state' }).click();
  await expect(page.getByText('No issues')).toBeVisible();
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByText('Rejected: f(s₀, λ) = s₀ ∉ F')).toBeVisible();
});

test('grammar workbench classifies with the course table', async ({ page }) => {
  await page.goto('/cmb/grammars/');
  const editor = page.getByLabel(/Productions P/);
  await editor.fill('S -> 0S1 | λ');
  await expect(page.getByText('G is of type 2', { exact: false })).toBeVisible();
  await expect(page.getByText('S → λ fails type 1 because S appears on the right-hand side of S → 0S1.')).toBeVisible();
});

test('practice: wrong answers get feedback, statements are prerendered', async ({ page, request }) => {
  const html = await (await request.get('/cmb/practice/ends-in-01/')).text();
  expect(html).toContain('Build an FSM without output that recognises the bit strings ending in');
  expect(html).toContain('"@type":"LearningResource"');
  await page.goto('/cmb/practice/ends-in-01/');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByText('S is empty. Add at least one state.')).toBeVisible();
  await page.getByRole('button', { name: /Hint \(0\/3\)/ }).click();
  await expect(page.getByRole('button', { name: /Hint \(1\/3\)/ })).toBeVisible();
});

test('sitemap lists every prerendered page', async ({ request }) => {
  const xml = await (await request.get('/cmb/sitemap.xml')).text();
  const count = (xml.match(/<loc>/g) ?? []).length;
  expect(count).toBe(7 + 7 + 70);
});

test('grammar workbench: λ button, L(G) panel and language → grammar', async ({ page }) => {
  await page.goto('/cmb/grammars/');
  const editor = page.getByLabel(/Productions P/);
  await editor.fill('S -> 0S1 | ');
  await editor.press('End');
  await page.getByRole('button', { name: 'Insert λ (the empty string)' }).first().click();
  await expect(editor).toHaveValue('S -> 0S1 | λ');
  await expect(page.getByLabel('The language L(G)').getByText('λ, 01, 0011, 000111')).toBeVisible();
  await page.getByRole('tab', { name: 'From L' }).click();
  await page.getByRole('button', { name: 'Build grammar' }).click();
  await expect(page.getByText('L(G) agrees with L on every string up to length 10.')).toBeVisible();
});

test('guides are prerendered and linked', async ({ request }) => {
  const html = await (await request.get('/cmb/guides/subset-construction/')).text();
  expect(html).toContain('The subset construction');
  expect(html).toContain('"@type":["Article","LearningResource"]');
});
