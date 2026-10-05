import Link from 'next/link';
import { defaultLocale } from '@/i18n/routing';

/**
 * Fallback for URLs outside any locale segment. It cannot use translations —
 * there is no resolved locale — so it stays deliberately minimal and points at
 * the default language.
 */
export default function RootNotFound() {
  return (
    <html lang={defaultLocale}>
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'grid',
          placeItems: 'center',
          minHeight: '100dvh',
          margin: 0,
          color: '#1b2430',
        }}
      >
        <main style={{ textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>404</h1>
          <p style={{ marginBottom: '1.5rem', color: '#5a6472' }}>Page not found</p>
          <Link href={`/${defaultLocale}`} style={{ color: '#2f4f7f' }}>
            Go to homepage
          </Link>
        </main>
      </body>
    </html>
  );
}
