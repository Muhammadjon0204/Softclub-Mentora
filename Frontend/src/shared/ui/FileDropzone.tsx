import { AlertTriangle, FileText, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { IconButton } from './Button';

export interface PendingFile {
  /** Client-local id (никогда не путается с server-side id — файл ещё не отправлен). */
  id: string;
  file: File;
  status: 'uploading' | 'ready' | 'error';
  progress: number;
  errorMessage?: string;
}

export interface FileDropzoneProps {
  /** Например `['pdf', 'pptx']` — сверяется с расширением имени файла в нижнем регистре. */
  acceptExtensions: string[];
  maxSizeBytes: number;
  files: PendingFile[];
  onFilesChange: (files: PendingFile[]) => void;
  disabled?: boolean;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * Загрузка файла решения (FE-016/017 ТЗ 2.2, раздел 24.6) — drag & drop зона
 * + кнопка выбора, клиентская предпроверка расширения/размера до отправки
 * (не заменяет серверную валидацию, только экономит трафик). Раз в preview
 * нет настоящего backend/хранилища — "загрузка" эмулируется короткой
 * анимацией прогресса, но реального состояния (`Submission`) это не
 * подменяет: файл считается отправленным только после клика «Отправить на
 * проверку», который вызывает настоящую мутацию стора.
 */
export function FileDropzone({ acceptExtensions, maxSizeBytes, files, onFilesChange, disabled = false }: FileDropzoneProps): JSX.Element {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef(new Set<ReturnType<typeof setInterval>>());
  /** Всегда актуальный `files` для колбэков `setInterval` — `files` как проп меняется по кадрам, обычное замыкание читало бы устаревший снимок и затирало бы прогресс параллельно грузящихся файлов. */
  const filesRef = useRef(files);
  filesRef.current = files;
  const onFilesChangeRef = useRef(onFilesChange);
  onFilesChangeRef.current = onFilesChange;

  useEffect(() => () => { timersRef.current.forEach((t) => { clearInterval(t); }); }, []);

  function simulateUpload(id: string): void {
    let progress = 0;
    const timer = setInterval(() => {
      progress = Math.min(100, progress + 20 + Math.random() * 20);
      onFilesChangeRef.current(
        filesRef.current.map((f) => (f.id === id ? { ...f, progress, status: progress >= 100 ? 'ready' : 'uploading' } : f)),
      );
      if (progress >= 100) {
        clearInterval(timer);
        timersRef.current.delete(timer);
      }
    }, 180);
    timersRef.current.add(timer);
  }

  function addFiles(list: FileList): void {
    if (disabled) return;
    const accepted: PendingFile[] = [];
    for (const raw of Array.from(list)) {
      const ext = extensionOf(raw.name);
      const id = `pf-${String(Date.now())}-${String(Math.round(Math.random() * 100000))}`;
      if (!acceptExtensions.includes(ext)) {
        accepted.push({ id, file: raw, status: 'error', progress: 0, errorMessage: `Допустимы только ${acceptExtensions.map((e) => e.toUpperCase()).join(' и ')}` });
        continue;
      }
      if (raw.size > maxSizeBytes) {
        accepted.push({ id, file: raw, status: 'error', progress: 0, errorMessage: `Файл больше ${formatFileSize(maxSizeBytes)}` });
        continue;
      }
      accepted.push({ id, file: raw, status: 'uploading', progress: 0 });
    }
    const next = [...files, ...accepted];
    onFilesChange(next);
    for (const f of accepted) if (f.status === 'uploading') simulateUpload(f.id);
  }

  function removeFile(id: string): void {
    onFilesChange(files.filter((f) => f.id !== id));
  }

  function retry(id: string): void {
    const target = files.find((f) => f.id === id);
    if (target === undefined) return;
    onFilesChange(files.map((f) => (f.id === id ? { ...f, status: 'uploading', progress: 0, errorMessage: undefined } : f)));
    simulateUpload(id);
  }

  return (
    <div className="space-y-2.5">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => { if (!disabled) inputRef.current?.click(); }}
        onKeyDown={(event) => { if (!disabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => { setDragOver(false); }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (!disabled && event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-control border-2 border-dashed px-4 py-7 text-center transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
          disabled ? 'cursor-not-allowed border-line bg-surface-muted opacity-60' : dragOver ? 'border-brand bg-brand-soft' : 'border-line bg-surface-muted hover:border-line-strong'
        }`}
      >
        <Upload className={`h-6 w-6 ${dragOver ? 'text-brand' : 'text-ink-muted'}`} aria-hidden="true" />
        <p className="text-[13px] font-medium text-ink">Перетащите файл сюда</p>
        <p className="text-[12px] text-ink-muted">
          или <span className="font-medium text-brand">выберите файл</span> · {acceptExtensions.map((e) => e.toUpperCase()).join(', ')} до {formatFileSize(maxSizeBytes)}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={disabled}
          accept={acceptExtensions.map((e) => `.${e}`).join(',')}
          className="sr-only"
          onChange={(event) => { if (event.target.files !== null && event.target.files.length > 0) addFiles(event.target.files); event.target.value = ''; }}
        />
      </div>

      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f.id} className={`rounded-control-sm border px-3 py-2.5 ${f.status === 'error' ? 'border-danger-border bg-danger-soft' : 'border-line bg-surface'}`}>
              <div className="flex items-center gap-2.5">
                {f.status === 'error' ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-ink">{f.file.name}</p>
                  {f.status === 'error' ? (
                    <p className="text-[11.5px] text-danger">{f.errorMessage}</p>
                  ) : (
                    <p className="text-[11px] text-ink-muted">{formatFileSize(f.file.size)}{f.status === 'uploading' ? ' · Загрузка…' : ''}</p>
                  )}
                </div>
                {f.status === 'error' ? (
                  <button type="button" onClick={() => { retry(f.id); }} className="shrink-0 text-[12px] font-medium text-brand hover:underline">
                    Повторить
                  </button>
                ) : null}
                <IconButton label="Удалить файл" size="sm" onClick={() => { removeFile(f.id); }}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </IconButton>
              </div>
              {f.status === 'uploading' ? (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full rounded-full bg-brand transition-all duration-150" style={{ width: `${String(f.progress)}%` }} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
