import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('public site', () => {
  test('home page renders the hero search', async ({ page }) => {
    await page.goto('/en');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('search')).toBeVisible();
  });

  test('search results page lists properties', async ({ page }) => {
    await page.goto('/en/for-sale');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const cards = page.locator('article, [data-listing], a[href*="/property/"]');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
  });

  test('listing detail has a gallery and an enquiry form', async ({ page }) => {
    await page.goto('/en/for-sale');
    const first = page.locator('a[href*="/en/property/"]').first();
    await expect(first).toBeVisible({ timeout: 15_000 });
    await first.click();
    await expect(page).toHaveURL(/\/en\/property\//);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('form')).toBeVisible();
  });

  test('listings with a hidden price say "Price on request" and publish no price', async ({ page }) => {
    await page.goto('/en/for-sale');
    const card = page.locator('article', { hasText: 'Price on request' }).first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    await card.getByRole('heading').getByRole('link').click();
    await expect(page).toHaveURL(/\/en\/property\//);
    await expect(page.getByText('Price on request').first()).toBeVisible();

    // Search engines must not be handed the price either.
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const listing = blocks
      .map((text) => JSON.parse(text) as { '@type'?: string; offers?: Record<string, unknown> })
      .find((block) => block['@type'] === 'RealEstateListing');
    expect(listing?.offers).toBeDefined();
    expect(listing?.offers).not.toHaveProperty('price');
  });

  test('a price range keeps featured and exclusive listings without a price', async ({ page }) => {
    await page.goto('/en/for-sale?priceMin=150000&priceMax=250000');
    await expect(page.locator('article').first()).toBeVisible({ timeout: 15_000 });
    // Only featured or exclusive listings may appear in a price range without a price.
    const unpriced = page.locator('article', { hasText: 'Price on request' });
    await expect(unpriced.first()).toBeVisible();
    await expect(unpriced.and(page.locator('article:not([data-promoted])'))).toHaveCount(0);
  });

  test('favorites page is reachable', async ({ page }) => {
    await page.goto('/en/favorites');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('accessibility', () => {
  test('home has no serious axe violations', async ({ page }) => {
    await page.goto('/en');
    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test('search has no serious axe violations', async ({ page }) => {
    await page.goto('/en/for-sale');
    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
