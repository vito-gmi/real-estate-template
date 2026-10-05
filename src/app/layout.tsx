import type { ReactNode } from 'react';

/**
 * The `[locale]` layout renders `<html>` and `<body>` because the `lang`
 * attribute depends on the resolved locale. This root layout exists only to
 * satisfy the App Router's requirement that `app/layout` exists.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
