import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * The public "list your property" form.
 *
 * These checks need no uploads, captcha or mail: they cover the page, its
 * entry points and the client-side validation. They assume submissions are
 * enabled (the default) and that the app runs with the local storage driver
 * or a configured private bucket.
 */
test.describe('property submissions', () => {
  test('the header links to the form', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('header a', { hasText: 'List your property' }).first()).toHaveAttribute(
      'href',
      '/en/list-your-property',
    );
  });

  test('the form renders in both languages', async ({ page }) => {
    await page.goto('/en/list-your-property');
    await expect(page.getByRole('heading', { level: 1, name: 'List your property' })).toBeVisible();
    await expect(page.getByRole('form', { name: 'List your property' })).toBeVisible();

    await page.goto('/bg/predlozhete-imot');
    await expect(page.getByRole('heading', { level: 1, name: 'Предложи имот' })).toBeVisible();
  });

  test('a segment in the wrong language redirects', async ({ page }) => {
    await page.goto('/en/predlozhete-imot');
    await expect(page).toHaveURL(/\/en\/list-your-property$/);
  });

  test('"Rent out" links preselect the deal and show rental terms', async ({ page }) => {
    await page.goto('/en/list-your-property?deal=rent');
    await expect(page.locator('input[type=radio][value=rent]')).toBeChecked();
    await expect(page.getByLabel('Available from')).toBeVisible();
  });

  test('sending an empty form explains what is missing', async ({ page }) => {
    await page.goto('/en/list-your-property');
    await page.getByRole('button', { name: 'Send property' }).click();

    await expect(page.getByText('Choose a city, or tick the box and type the place')).toBeVisible();
    await expect(page.getByText('Please write at least 30 characters')).toBeVisible();
    await expect(page.getByText('Enter your first name')).toBeVisible();
    await expect(page.getByText('Your consent is needed before we can accept the property.')).toBeVisible();
  });

  test('the form has no serious accessibility violations', async ({ page }) => {
    await page.goto('/en/list-your-property');
    await expect(page.getByRole('form')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const blocking = results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    );
    expect(blocking).toEqual([]);
  });
});
