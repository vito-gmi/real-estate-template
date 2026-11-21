import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { ImageResponse } from 'next/og';
import { siteConfig } from '@/config/site';

/** Browser tab icon. Lives outside `[locale]` so `/favicon.ico` is not a language. */
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/** Formats the image renderer (Satori) can decode. WebP, AVIF and ICO are not among them. */
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

/**
 * `siteConfig.favicon` as a data URI, read once when the module loads — the
 * icon is generated at build time, so this never touches the disk per request.
 * A wrong path or format fails the build with a message naming the setting.
 */
async function loadFavicon(publicPath: string): Promise<string> {
  const mime = MIME_BY_EXTENSION[extname(publicPath).toLowerCase()];
  if (!mime) {
    throw new Error(
      `siteConfig.favicon "${publicPath}" must be a .png, .jpg, .jpeg or .svg file in public/.`,
    );
  }
  const file = join(
    /* turbopackIgnore: true */ process.cwd(),
    'public',
    publicPath.replace(/^\/+/, ''),
  );
  const data = await readFile(file).catch(() => {
    throw new Error(`siteConfig.favicon "${publicPath}" was not found at ${file}.`);
  });
  return `data:${mime};base64,${data.toString('base64')}`;
}

const faviconSrc = siteConfig.favicon ? await loadFavicon(siteConfig.favicon) : null;

export default function Icon() {
  if (faviconSrc) {
    return new ImageResponse(
      (
        <div style={{ display: 'flex', width: '100%', height: '100%' }}>
          <img
            src={faviconSrc}
            width={size.width}
            height={size.height}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      ),
      size,
    );
  }

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
