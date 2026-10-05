'use client';

import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/routing';
import { createPreviewLink } from '../listing-actions';

export function PreviewLinkButton({
  listingId,
  locale,
}: {
  listingId: string;
  locale: Locale;
}) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);

  async function create() {
    setPending(true);
    const result = await createPreviewLink({ id: listingId, locale });
    setPending(false);
    if (!result?.data?.ok) return;

    const url = new URL(result.data.data.url, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    window.open(url, '_blank', 'noopener,noreferrer');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void create()}>
      <Link2 />
      {copied ? tCommon('copied') : t('previewLink')}
    </Button>
  );
}
