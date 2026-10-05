'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { importListings } from '../import-actions';

export function ImportExportBar() {
  const t = useTranslations('admin');
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function download(format: 'json' | 'csv') {
    const response = await fetch(`/api/admin/export?format=${format}`);
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `listings.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setMessage(null);
    const content = await file.text();
    const result = await importListings({ filename: file.name, content });
    setPending(false);
    if (result?.data?.ok) {
      setMessage(t('import.imported', { count: result.data.data.count }));
      router.refresh();
    } else {
      setMessage(result?.data && !result.data.ok ? result.data.error.messageKey : t('import.failed'));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => void download('json')}>
        <Download />
        {t('import.exportJson')}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => void download('csv')}>
        <Download />
        {t('import.exportCsv')}
      </Button>
      <label className="inline-flex">
        <input
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className="sr-only"
          disabled={pending}
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <span className="inline-flex">
          <Button type="button" variant="outline" size="sm" disabled={pending} asChild>
            <span>
              <Upload />
              {pending ? t('import.importing') : t('import.importFile')}
            </span>
          </Button>
        </span>
      </label>
      {message ? <p className="text-sm text-ink-muted">{message}</p> : null}
    </div>
  );
}
