import { ImageResponse } from 'next/og';
import { siteConfig } from '@/config/site';

/** Browser tab icon. Lives outside `[locale]` so `/favicon.ico` is not a language. */
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  const mark = siteConfig.name.trim().charAt(0).toUpperCase() || 'E';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#101720',
          color: '#f4f6f9',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: -0.5,
        }}
      >
        {mark}
      </div>
    ),
    size,
  );
}
