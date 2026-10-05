'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/**
 * Share control.
 *
 * Uses the native share sheet where the platform offers one — which is most
 * phones, and where most property links are actually shared — and falls back to
 * copying the URL everywhere else.
 */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  const t = useTranslations('listing');
  const tCommon = useTranslations('common');
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // The visitor dismissed the sheet; fall through to copying.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; nothing useful to do but stay quiet.
    }
  }

  return (
    <Button type="button" variant="outline" onClick={share} className={className}>
      {copied ? <Check /> : <Share2 />}
      {copied ? t('linkCopied') : tCommon('share')}
    </Button>
  );
}
