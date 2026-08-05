import { Download, FileText, ShieldCheck } from 'lucide-react';

import { Modal } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import type { SubmissionFile } from './assignmentPresentation';

export interface FileDetailsModalProps {
  file: SubmissionFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** PPTX и прочие неподдерживаемые типы — раздел 17 промпта: без inline preview, без обещания антивируса. */
export function FileDetailsModal({ file, open, onOpenChange }: FileDetailsModalProps): JSX.Element {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Файл решения" size="sm" ariaLabel={file !== null ? `Файл: ${file.name}` : 'Файл решения'}>
      {file !== null ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-control border border-line bg-surface-muted p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-ink" title={file.name}>{file.name}</p>
              <p className="text-[12px] text-ink-muted">{file.sizeLabel} · {file.extension.toUpperCase()}</p>
            </div>
          </div>

          <dl className="divide-y divide-divider">
            <div className="flex items-center justify-between py-2 text-[13px]">
              <span className="text-ink-muted">Загружено</span>
              <span className="font-medium text-ink">{file.uploadedLabel}</span>
            </div>
            <div className="flex items-center justify-between py-2 text-[13px]">
              <span className="text-ink-muted">Статус проверки</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-success">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Проверен (OPC)
              </span>
            </div>
          </dl>

          <p className="rounded-control-sm border border-line bg-surface-muted px-3 py-2.5 text-[12.5px] leading-[18px] text-ink-secondary">
            Предпросмотр {file.extension.toUpperCase()} недоступен. Файл можно скачать после проверки.
          </p>

          <Button variant="secondary" leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />} className="w-full justify-center" disabled title="Preview-режим — скачивание пока не подключено">
            Скачать файл
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}
