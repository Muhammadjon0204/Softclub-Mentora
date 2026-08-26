import { AlertTriangle, FileText, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { IconButton } from './Button';

export interface PendingFile {
  /** Client-local id (никогда не путается с server-side id — файл ещё не отправлен). */
  id: string;
  file: File;
  /**
   * `'ready'` — прошёл клиентскую предпроверку, ждёт «Отправить»; реальная сеть ещё не тронута.
   * `'uploading'` — идёт настоящий `POST` этого конкретного файла (см. `useSubmitAssignment.ts`),
   * `progress` — реальные отправленные байты, а не анимация. `'error'` — либо клиентская
   * предпроверка не прошла, либо реальная загрузка вернула ошибку (`errorMessage` в обоих случаях).
   */
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
 * (не заменяет серверную валидацию, только экономит трафик). Файл,
 * прошедший предпроверку, сразу становится `'ready'` — реальная сеть
 * (настоящий `POST .../submissions`, `SB1`) начинается только по клику
 * «Отправить на проверку» в `SubmissionForm`, а не при добавлении файла:
 * каждый успешный `POST` необратимо создаёт новую версию на backend, так
 * что дропзона не должна отправлять что-либо, пока пользователь явно не
 * подтвердил намерение (см. `useSubmitAssignment.ts`, которое затем ведёт
 * `status`/`progress` каждого файла через те же поля `PendingFile` — но уже
 * настоящими отправленными байтами, а не анимацией).
 */
export function FileDropzone({ acceptExtensions, maxSizeBytes, files, onFilesChange, disabled = false }: FileDropzoneProps): JSX.Element {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      accepted.push({ id, file: raw, status: 'ready', progress: 100 });
    }
    onFilesChange([...files, ...accepted]);
  }

  function removeFile(id: string): void {
    onFilesChange(files.filter((f) => f.id !== id));
  }

  /** Сбрасывает файл, не прошедший загрузку (клиентскую предпроверку или реальный `POST`), обратно в очередь на отправку. Сама повторная отправка — по следующему клику «Отправить на проверку», не здесь (см. верхний doc comment). */
  function retry(id: string): void {
    onFilesChange(files.map((f) => (f.id === id ? { ...f, status: 'ready', progress: 100, errorMessage: undefined } : f)));
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
