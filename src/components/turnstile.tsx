'use client';

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';

/**
 * Cloudflare Turnstile widget, rendered explicitly.
 *
 * The script is loaded only on pages that show the widget, once per page
 * load. `refresh-expired: auto` swaps in a fresh token if the visitor spends
 * longer than five minutes on the form, so a slow, careful visitor is never
 * the one who fails the check.
 */

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Turnstile failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export type TurnstileHandle = {
  /** Tokens are single-use: call after a submit the server rejected. */
  reset: () => void;
};

export function Turnstile({
  siteKey,
  action,
  language,
  onToken,
  onError,
  handleRef,
}: {
  siteKey: string;
  action: string;
  language: string;
  onToken: (token: string | null) => void;
  /** The script could not load or the challenge errored (e.g. a blocker). */
  onError?: () => void;
  handleRef?: Ref<TurnstileHandle>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  // Read through a ref so a new callback identity never re-renders the widget.
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onTokenRef.current = onToken;
    onErrorRef.current = onError;
  }, [onToken, onError]);

  useImperativeHandle(handleRef, () => ({
    reset: () => {
      onTokenRef.current(null);
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          action,
          language,
          'refresh-expired': 'auto',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => {
            onTokenRef.current(null);
            onErrorRef.current?.();
          },
        });
      })
      .catch(() => {
        onTokenRef.current(null);
        onErrorRef.current?.();
      });

    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, action, language]);

  return <div ref={container} className="min-h-[65px]" />;
}
