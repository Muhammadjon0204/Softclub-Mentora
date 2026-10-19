import { useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';

import type { AuthUser } from '../../api/auth';
import { AVATAR_DIRECTORY_QUERY_KEY, removeAvatar, uploadAvatar } from '../../api/avatars';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { useAuth } from '../../auth/useAuth';
import { ConfirmDialog, Tooltip } from '../../shared/overlays';
import { useToast } from '../../shared/overlays/useToast';
import { Avatar } from '../../shared/ui/Avatar';
import { AvatarCropDialog } from './AvatarCropDialog';
import { avatarColorClass } from './profilePresentation';
import { useAvatarColor } from './useAvatarColor';

// Исходник можно взять и тяжёлый — с телефона; уходит на сервер уже 512×512.
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

const EDGE_BUTTON =
  'grid place-items-center rounded-full shadow-[0_4px_12px_rgba(20,28,58,0.18)] ring-[3px] ring-white transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60';

/** Кольцо прогресса поверх аватара, пока фото уходит на сервер. */
function UploadRing({ progress }: { progress: number }): JSX.Element {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  return (
    <motion.svg
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      viewBox="0 0 120 120"
      className="pointer-events-none absolute -inset-1.5 h-[calc(100%+12px)] w-[calc(100%+12px)] -rotate-90"
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="4" className="stroke-brand-soft" />
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        className="stroke-brand transition-[stroke-dashoffset] duration-200"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - Math.max(0.04, progress))}
      />
    </motion.svg>
  );
}

/**
 * Аватар профиля с двумя кнопками на краю круга: камера — поставить или заменить
 * фото, корзина — удалить. Фото можно и просто перетащить на круг. Новое фото
 * сразу появляется везде: ответ сервера обновляет сессию этой вкладки, а realtime —
 * остальные вкладки и экраны коллег.
 */
export function ProfileAvatarEditor({ user }: { user: AuthUser }): JSX.Element {
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const color = useAvatarColor(user.id);
  const inputRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const hasPhoto = (user.avatarUrl ?? null) !== null;
  const busy = progress !== null || removing;

  // object URL живёт ровно столько, сколько открыт диалог.
  useEffect(() => () => { if (source !== null) URL.revokeObjectURL(source); }, [source]);

  const applyProfile = (next: AuthUser): void => {
    updateUser(next);
    void queryClient.invalidateQueries({ queryKey: AVATAR_DIRECTORY_QUERY_KEY });
  };

  const openFile = (file: File | undefined): void => {
    if (file === undefined) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение: JPEG, PNG или WebP.');
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error('Файл больше 20 МБ — выберите фото поменьше.');
      return;
    }
    setSource(URL.createObjectURL(file));
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    openFile(event.target.files?.[0]);
    // Тот же файл можно выбрать повторно.
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragOver(false);
    if (!busy) openFile(event.dataTransfer.files[0]);
  };

  const save = async (image: Blob): Promise<void> => {
    setProgress(0);
    try {
      applyProfile(await uploadAvatar(image, setProgress));
      setSource(null);
      toast.success(hasPhoto ? 'Фото обновлено' : 'Фото добавлено');
    } catch (error) {
      toast.error(getGenericErrorMessage(error));
      throw error;
    } finally {
      setProgress(null);
    }
  };

  const remove = async (): Promise<void> => {
    setRemoving(true);
    try {
      applyProfile(await removeAvatar());
      setConfirmRemove(false);
      toast.success('Фото удалено');
    } catch (error) {
      toast.error(getGenericErrorMessage(error));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <div
        className="relative"
        onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
        onDragLeave={() => { setDragOver(false); }}
        onDrop={onDrop}
      >
        <motion.div
          animate={{ scale: dragOver ? 1.05 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 26 }}
          className={`rounded-full p-1 ring-1 transition-colors ${dragOver ? 'bg-brand-soft ring-brand' : 'bg-surface ring-line'}`}
        >
          <Avatar
            name={user.fullName}
            src={user.avatarUrl}
            size="2xl"
            fallbackClassName={avatarColorClass(color)}
            className={busy ? 'opacity-70 transition-opacity' : 'transition-opacity'}
          />
        </motion.div>

        <AnimatePresence>{progress !== null ? <UploadRing progress={progress} /> : null}</AnimatePresence>

        <div className="absolute bottom-0.5 right-0.5">
          <Tooltip content={hasPhoto ? 'Заменить фото' : 'Загрузить фото'}>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              aria-label={hasPhoto ? 'Заменить фото профиля' : 'Загрузить фото профиля'}
              className={`${EDGE_BUTTON} h-10 w-10 bg-brand text-white hover:bg-brand-hover`}
            >
              <Camera className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>

        <AnimatePresence>
          {hasPhoto ? (
            <motion.div
              key="remove"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute right-0.5 top-0.5"
            >
              <Tooltip content="Удалить фото">
                <button
                  type="button"
                  onClick={() => { setConfirmRemove(true); }}
                  disabled={busy}
                  aria-label="Удалить фото профиля"
                  className={`${EDGE_BUTTON} h-8 w-8 bg-surface text-ink-secondary hover:bg-danger-soft hover:text-danger`}
                >
                  <Trash2 className="h-[15px] w-[15px]" aria-hidden="true" />
                </button>
              </Tooltip>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={onInputChange}
        />
      </div>

      <AvatarCropDialog source={source} onCancel={() => { setSource(null); }} onSave={save} />

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Удалить фото профиля?"
        description="Вместо фото снова будут инициалы — у вас и у коллег."
        confirmLabel="Удалить"
        destructive
        loading={removing}
        onConfirm={remove}
        icon={<Trash2 className="h-5 w-5" aria-hidden="true" />}
      />
    </>
  );
}
