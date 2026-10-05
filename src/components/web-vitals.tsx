'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { isWithinBudget } from '@/lib/web-vitals-budget';

/**
 * Reports Core Web Vitals once per metric.
 *
 * The callback is a module-level function so its identity is stable across
 * renders — `useReportWebVitals` re-fires every time the reference changes.
 */
function reportWebVitals(metric: { name: string; value: number; id: string; rating: string }) {
  if (process.env.NODE_ENV !== 'production') {
    const within = isWithinBudget(metric.name, metric.value);
    console.debug(`[web-vital] ${metric.name}=${metric.value.toFixed(1)} (${metric.rating})${within ? '' : ' OVER BUDGET'}`);
  }

  const consent =
    typeof window !== 'undefined' ? window.localStorage.getItem('estate:cookie-consent:v1') : null;
  if (consent !== 'accepted') return;

  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    rating: metric.rating,
    path: window.location.pathname,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  }
}

export function WebVitals() {
  useReportWebVitals(reportWebVitals);
  return null;
}
