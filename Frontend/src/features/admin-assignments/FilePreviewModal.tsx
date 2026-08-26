import { Download, FileText, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getSubmissionDownloadUrl, getSubmissionPreviewUrl } from '../../api/lead/submissions';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { Modal, useToast } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import type { SubmissionFile } from './assignmentPresentation';

export interface FilePreviewModalProps {
  file: SubmissionFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * SB4: `GET /submissions/{id}/preview-url` — PDF only (the caller only ever opens this modal for a
 * `.pdf` file, see `handleOpenFile` in every drawer that uses it). Fetched on open rather than only on
 * a button click, since the whole point of this modal is to show the preview immediately.
 * `file.id` is the submission's own id, same reasoning as `FileDetailsModal.tsx`.
 */
export function FilePreviewModal({ file, open, onOpenChange }: FilePreviewModalProps): JSX.Element {
  const toast = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open || file === null) {
      setPreviewUrl(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    setPreviewError(null);
    getSubmissionPreviewUrl(file.id)
      .then(({ url }) => { if (!cancelled) setPreviewUrl(url); })
      .catch((error: unknown) => { if (!cancelled) setPreviewError(getGenericErrorMessage(error)); })
      .finally(() => { if (!cancelled) setLoadingPreview(false); });
    return () => { cancelled = true; };
  }, [open, file]);

  async function handleDownload(): Promise<void> {
    if (file === null) return;
    setDownloading(true);
    try {
      const { url } = await getSubmissionDownloadUrl(file.id);
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      toast.error(getGenericErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  }

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

          <div className="flex h-72 items-center justify-center overflow-hidden rounded-control border border-line bg-surface-muted text-center">
            {loadingPreview ? (
              <div className="space-y-1.5 px-6">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-ink-disabled" aria-hidden="true" />
                <p className="text-[12.5px] text-ink-muted">Загрузка предпросмотра…</p>
              </div>
            ) : previewError !== null ? (
              <div className="space-y-1.5 px-6">
                <TriangleAlert className="mx-auto h-7 w-7 text-danger" aria-hidden="true" />
                <p className="text-[13px] font-medium text-danger">{previewError}</p>
              </div>
            ) : previewUrl !== null ? (
              <iframe src={previewUrl} title={`Предпросмотр: ${file.name}`} className="h-full w-full border-0" />
            ) : null}
          </div>

          <Button
            variant="secondary"
            leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
            className="w-full justify-center"
            isLoading={downloading}
            onClick={() => { void handleDownload(); }}
          >
            Скачать файл
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}
