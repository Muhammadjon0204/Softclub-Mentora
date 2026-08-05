import { Download, FileText, ShieldCheck } from 'lucide-react';

import { Modal } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import type { SubmissionFile } from './assignmentPresentation';

export interface FilePreviewModalProps {
  file: SubmissionFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** PDF — раздел 17 промпта: preview area placeholder в mock-режиме, без signed URL и без небезопасного HTML-контента. */
export function FilePreviewModal({ file, open, onOpenChange }: FilePreviewModalProps): JSX.Element {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Предпросмотр файла" size="lg" ariaLabel={file !== null ? `Предпросмотр: ${file.name}` : 'Предпросмотр файла'}>
      {file !== null ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-control border border-line bg-surface-muted p-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium text-ink" title={file.name}>{file.name}</p>
                <p className="text-[12px] text-ink-muted">{file.sizeLabel} · PDF · загружено {file.uploadedLabel}</p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-success">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Проверен
            </span>
          </div>

          <div className="flex h-72 items-center justify-center rounded-control border border-dashed border-line bg-surface-muted text-center">
            <div className="space-y-1.5 px-6">
              <FileText className="mx-auto h-8 w-8 text-ink-disabled" aria-hidden="true" />
              <p className="text-[13px] font-medium text-ink-secondary">Предпросмотр PDF в preview-режиме недоступен</p>
              <p className="text-[12px] text-ink-muted">Реальный рендер подключится вместе с backend-хранилищем файлов</p>
            </div>
          </div>

          <Button variant="secondary" leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />} className="w-full justify-center" disabled title="Preview-режим — скачивание пока не подключено">
            Скачать файл
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}
