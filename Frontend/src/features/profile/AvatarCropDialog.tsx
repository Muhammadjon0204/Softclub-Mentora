import { Minus, Move, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, WheelEvent } from 'react';

import { Modal } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { MAX_ZOOM, MIN_ZOOM, clampCrop, displayScale, exportCrop, type CropState } from './avatarCrop';

interface AvatarCropDialogProps {
  /** object URL выбранного файла; null — диалог закрыт. */
  source: string | null;
  onCancel: () => void;
  /** Получает готовый квадрат; пока промис не завершён, диалог показывает загрузку. */
  onSave: (image: Blob) => Promise<void>;
}

const START: CropState = { x: 0, y: 0, zoom: 1 };

/**
 * Кадрирование перед загрузкой: картинку двигают пальцем или мышью, масштабируют
 * колёсиком, ползунком или клавишами. Круг показывает ровно то, что увидят все.
 */
export function AvatarCropDialog({ source, onCancel, onSave }: AvatarCropDialogProps): JSX.Element {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; from: CropState } | null>(null);

  const [viewport, setViewport] = useState(288);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<CropState>(START);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNatural(null);
    setCrop(START);
    setError(null);
  }, [source]);

  // Окно подстраивается под ширину телефона.
  useEffect(() => {
    const node = viewportRef.current;
    if (node === null || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setViewport(entry.contentRect.width);
    });
    observer.observe(node);
    return () => { observer.disconnect(); };
  }, [source]);

  const update = (next: CropState): void => {
    if (natural !== null) setCrop(clampCrop(next, natural, viewport));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, from: crop };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const active = drag.current;
    if (active?.pointerId !== event.pointerId) return;
    update({ ...active.from, x: active.from.x + event.clientX - active.startX, y: active.from.y + event.clientY - active.startY });
  };

  const endDrag = (): void => { drag.current = null; };

  const onWheel = (event: WheelEvent<HTMLDivElement>): void => {
    update({ ...crop, zoom: crop.zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08) });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? 24 : 8;
    const moves: Record<string, Partial<CropState>> = {
      ArrowLeft: { x: crop.x + step },
      ArrowRight: { x: crop.x - step },
      ArrowUp: { y: crop.y + step },
      ArrowDown: { y: crop.y - step },
      '+': { zoom: crop.zoom * 1.1 },
      '=': { zoom: crop.zoom * 1.1 },
      '-': { zoom: crop.zoom / 1.1 },
    };
    const move = moves[event.key];
    if (move === undefined) return;
    event.preventDefault();
    update({ ...crop, ...move });
  };

  const save = async (): Promise<void> => {
    if (imageRef.current === null || natural === null) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(await exportCrop(imageRef.current, crop, viewport));
    } catch {
      setError('Не получилось сохранить фото. Попробуйте ещё раз или выберите другое.');
    } finally {
      setSaving(false);
    }
  };

  const scale = natural === null ? 1 : displayScale(natural, viewport, crop.zoom);

  return (
    <Modal
      open={source !== null}
      onOpenChange={(open) => { if (!open) onCancel(); }}
      title="Фото профиля"
      description="Перетащите фото, чтобы выбрать область. Колёсико или ползунок меняют масштаб."
      size="sm"
      preventClose={saving}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>Отмена</Button>
          <Button variant="primary" onClick={() => { void save(); }} isLoading={saving} disabled={natural === null}>
            Сохранить
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          ref={viewportRef}
          role="application"
          aria-label="Область фото: стрелки — сдвиг, плюс и минус — масштаб"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
          className="relative aspect-square w-full max-w-[288px] cursor-grab touch-none overflow-hidden rounded-2xl bg-surface-muted outline-none focus-visible:ring-2 focus-visible:ring-brand active:cursor-grabbing"
        >
          {source !== null ? (
            <img
              ref={imageRef}
              src={source}
              alt=""
              draggable={false}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                setNatural({ width: naturalWidth, height: naturalHeight });
              }}
              onError={() => { setError('Этот файл не открывается как изображение. Выберите JPEG, PNG или WebP.'); }}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={natural === null ? { opacity: 0 } : {
                width: natural.width * scale,
                height: natural.height * scale,
                transform: `translate(-50%, -50%) translate(${crop.x}px, ${crop.y}px)`,
              }}
            />
          ) : null}
          {/* Затемнение вокруг круга: всё, что вне него, на аватарке видно не будет. */}
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(15,23,42,0.55)] ring-2 ring-white/80" />
          {natural !== null && crop.x === 0 && crop.y === 0 && crop.zoom === 1 ? (
            <span className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11.5px] font-medium text-white backdrop-blur-sm">
              <Move className="h-3.5 w-3.5" aria-hidden="true" />
              Перетащите
            </span>
          ) : null}
        </div>

        <div className="flex w-full max-w-[288px] items-center gap-3">
          <button
            type="button"
            aria-label="Уменьшить"
            onClick={() => { update({ ...crop, zoom: crop.zoom / 1.15 }); }}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-secondary transition hover:bg-surface-hover"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={crop.zoom}
            onChange={(event) => { update({ ...crop, zoom: Number(event.target.value) }); }}
            aria-label="Масштаб"
            className="h-1.5 w-full cursor-pointer accent-brand"
          />
          <button
            type="button"
            aria-label="Увеличить"
            onClick={() => { update({ ...crop, zoom: crop.zoom * 1.15 }); }}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-secondary transition hover:bg-surface-hover"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {error !== null ? <p role="alert" className="text-center text-[13px] text-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}
