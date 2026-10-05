'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, CheckCircle2, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { InquiryStatus } from '@/lib/domain/enums';
import { setInquiryStatus } from '../inquiry-actions';

export function InquiryRowActions({ id, status }: { id: string; status: InquiryStatus }) {
  const t = useTranslations('admin.inquiryInbox');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function update(next: InquiryStatus) {
    setPending(true);
    await setInquiryStatus({ id, status: next });
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {status !== 'in_progress' ? (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => void update('in_progress')}>
          <Clock />
          {t('markInProgress')}
        </Button>
      ) : null}
      {status !== 'closed' ? (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => void update('closed')}>
          <CheckCircle2 />
          {t('markClosed')}
        </Button>
      ) : null}
      {status !== 'spam' ? (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => void update('spam')}>
          <Ban />
          {t('markSpam')}
        </Button>
      ) : null}
    </div>
  );
}
