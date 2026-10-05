import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // `next dev` rejects dev chunks and the HMR socket for any host but localhost,
  // so a phone on a tunnel or the LAN gets server HTML that never hydrates.
  // Extra hosts can be added via a comma-separated `DEV_ORIGINS`.
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.trycloudflare.com",
    "*.loca.lt",
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    "*.local",
    ...(process.env.DEV_ORIGINS?.split(",")
      .map((host) => host.trim())
      .filter(Boolean) ?? []),
  ],

  // Native modules must stay outside the bundle so they load from node_modules at runtime.
  serverExternalPackages: ["sharp", "@node-rs/argon2", "postgres"],

  experimental: {
    optimizePackageImports: ["lucide-react"],
    webVitalsAttribution: ["CLS", "LCP", "INP"],
  },

  ...(process.env.DOCKER_BUILD === "1"
    ? { output: "standalone" as const }
    : {}),

  async redirects() {
    return [
      // Locale-less entry points land on the default locale rather than a 404.
      { source: "/admin", destination: "/bg/admin", permanent: false },
    ];
  },

  async rewrites() {
    return [
      // Browsers request this by default. Without a rewrite it is matched as
      // `[locale]=favicon.ico` and the homepage queries Postgres with an
      // invalid enum value (500). `app/icon.tsx` is the real asset.
      { source: "/favicon.ico", destination: "/icon" },
    ];
  },
};

export default withNextIntl(nextConfig);
