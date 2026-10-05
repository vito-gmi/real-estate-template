/**
 * Core Web Vitals budget.
 *
 * Enforced in CI (Playwright + Lighthouse) and reported in production via
 * `useReportWebVitals`. Values match the plan: LCP < 2.0s, CLS < 0.05, INP < 200ms.
 */
export const webVitalsBudget = {
  LCP: 2000,
  CLS: 0.05,
  INP: 200,
  FCP: 1800,
  TTFB: 800,
} as const;

export type WebVitalName = keyof typeof webVitalsBudget;

export function isWithinBudget(name: string, value: number): boolean {
  const budget = webVitalsBudget[name as WebVitalName];
  if (budget === undefined) return true;
  return value <= budget;
}
