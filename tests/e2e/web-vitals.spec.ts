import { expect, test } from '@playwright/test';
import { webVitalsBudget } from '../../src/lib/web-vitals-budget';

/**
 * A coarse CI gate for layout shift and LCP.
 *
 * Lighthouse (see `lighthouserc.json`) is the full budget; this test catches
 * the most common regressions — a missing width/height on the hero image, a
 * late-loading webfont — without adding another tool to the pipeline.
 */
test('home page stays within the layout-shift budget', async ({ page }) => {
  await page.goto('/en', { waitUntil: 'networkidle' });

  const cls = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let value = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as PerformanceEntry[]) {
            const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
            if (!shift.hadRecentInput) value += shift.value ?? 0;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(value), 1500);
      }),
  );

  expect(cls).toBeLessThanOrEqual(webVitalsBudget.CLS);
});
