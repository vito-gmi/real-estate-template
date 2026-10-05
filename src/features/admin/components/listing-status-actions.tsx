'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, CheckCircle2, Clock, EyeOff, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DealType, ListingStatus } from '@/lib/domain/enums';
import { changeListingStatus, deleteListing } from '../listing-actions';

/**
 * Lifecycle controls.
 *
 * Publishing is a single obvious button because it is the action taken dozens of
 * times a day; the rarer transitions live behind a menu, and deletion — the only
 * irreversible one — is both administrator-only and confirmed.
 */
export function ListingStatusActions({
  listingId,
  status,
  dealType,
  canDelete,
  listingsPath,
}: {
  listingId: string;
  status: ListingStatus;
  dealType: DealType;
  canDelete: boolean;
  listingsPath: string;
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function setStatus(next: ListingStatus) {
    setPending(true);
    await changeListingStatus({ id: listingId, status: next });
    setPending(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(t('confirmDelete'))) return;
    setPending(true);
    const result = await deleteListing({ id: listingId });
    setPending(false);
    if (result?.data?.ok) router.replace(listingsPath);
  }

  const isPublished = status !== 'draft' && status !== 'archived';

  return (
    <div className="flex items-center gap-2">
      {isPublished ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setStatus('draft')}>
          <EyeOff />
          {t('unpublish')}
        </Button>
      ) : (
        <Button size="sm" disabled={pending} onClick={() => setStatus('active')}>
          <CheckCircle2 />
          {t('publish')}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={pending}>
            …
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => void setStatus('reserved')}>
            <Clock className="size-4" />
            {t('markReserved')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void setStatus(dealType === 'sale' ? 'sold' : 'rented')}
          >
            <CheckCircle2 className="size-4" />
            {dealType === 'sale' ? t('markSold') : t('markRented')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void setStatus('archived')}>
            <Archive className="size-4" />
            {t('archive')}
          </DropdownMenuItem>

          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void remove()} className="text-danger">
                <Trash2 className="size-4" />
                {t('delete')}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
