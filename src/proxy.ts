import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import {
  buildCsp,
  hstsHeader,
  staticSecurityHeaders,
} from "@/lib/security/headers";

/**
 * Runs before every page request.
 *
 * Responsibilities are deliberately narrow — locale resolution, security headers
 * and a cheap authentication gate. Rate limiting lives in the server actions and
 * route handlers instead, because only they know the actor and the operation
 * being attempted, and because a Redis round-trip here would tax cached pages.
 */

const handleI18nRouting = createIntlMiddleware(routing);

/** better-auth prefixes the cookie with `__Secure-` when served over TLS. */
const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

const ADMIN_SEGMENT = "/admin";
const LOGIN_SEGMENT = "/admin/login";

function isAdminPath(pathname: string): boolean {
  return pathname.includes(ADMIN_SEGMENT);
}

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) =>
    Boolean(request.cookies.get(name)?.value),
  );
}

function localeFromPath(pathname: string): string {
  const [, maybeLocale] = pathname.split("/");
  return routing.locales.includes(
    maybeLocale as (typeof routing.locales)[number],
  )
    ? (maybeLocale as string)
    : routing.defaultLocale;
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const admin = isAdminPath(pathname);

  // Next.js reads the nonce from the *request* CSP header and stamps it onto
  // its own scripts. Setting it only on the response would leave those scripts
  // blocked. Public pages stay on the static policy (see headers.ts).
  const nonce = admin
    ? Buffer.from(crypto.randomUUID()).toString("base64")
    : undefined;
  const requestHeaders = new Headers(request.headers);
  const csp = admin && nonce ? buildCsp("nonce", nonce) : buildCsp("static");
  requestHeaders.set("Content-Security-Policy", csp);
  if (nonce) requestHeaders.set("x-nonce", nonce);

  const forwarded = new NextRequest(request, { headers: requestHeaders });

  // The presence check is a fast path only. Every admin route re-validates the
  // session server-side, so a forged cookie buys an attacker nothing but a redirect.
  if (
    admin &&
    !pathname.includes(LOGIN_SEGMENT) &&
    !hasSessionCookie(request)
  ) {
    const locale = localeFromPath(pathname);
    const loginUrl = new URL(`/${locale}${LOGIN_SEGMENT}`, request.url);
    loginUrl.searchParams.set("next", pathname);
    return applySecurityHeaders(
      NextResponse.redirect(loginUrl),
      request,
      admin,
      nonce,
    );
  }

  const response = handleI18nRouting(forwarded);
  return applySecurityHeaders(response, request, admin, nonce);
}

/**
 * The public site is identical for every visitor — favourites and consent live
 * in the browser, never in the HTML — so responses can be cached at the edge and
 * revalidated in the background. This is what lets a search URL be served
 * without touching the origin, and what keeps the site up while the database is
 * not.
 */
const PUBLIC_CACHE_CONTROL =
  "public, s-maxage=300, stale-while-revalidate=86400";

function applySecurityHeaders(
  response: NextResponse,
  request: NextRequest,
  admin: boolean,
  nonce: string | undefined,
): NextResponse {
  for (const [key, value] of staticSecurityHeaders) {
    response.headers.set(key, value);
  }

  if (request.nextUrl.protocol === "https:") {
    response.headers.set(hstsHeader[0], hstsHeader[1]);
  }

  if (request.nextUrl.searchParams.has("preview")) {
    response.headers.set("Cache-Control", "private, no-store");
  } else if (!admin && request.method === "GET") {
    response.headers.set("Cache-Control", PUBLIC_CACHE_CONTROL);
  } else {
    response.headers.set("Cache-Control", "private, no-store");
  }

  const csp = admin && nonce ? buildCsp("nonce", nonce) : buildCsp("static");
  response.headers.set("Content-Security-Policy", csp);
  if (nonce) response.headers.set("x-nonce", nonce);

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except: API routes, Next internals, locally served media, the
     * machine-readable endpoints that are locale-agnostic by design (sitemaps,
     * feeds), the generated tab icon (`app/icon.tsx`, served at `/icon`), and
     * files that already carry an extension.
     *
     * Getting this list wrong is subtle: a missing entry makes the locale
     * middleware redirect `/sitemap.xml` to `/bg/sitemap.xml`, which crawlers
     * see as a broken sitemap — and `/icon` to `/bg/icon`, a 404, which leaves
     * every page without a favicon.
     */
    "/((?!api|_next/static|_next/image|media|feed|sitemap|sitemaps|icon$|.*\\.[\\w]+$).*)",
  ],
};
