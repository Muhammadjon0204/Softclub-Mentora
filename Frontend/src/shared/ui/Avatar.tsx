import { useState } from 'react';
import type { HTMLAttributes } from 'react';

import { initialsOf, resolveAvatarUrl } from './avatarSource';

export type AvatarSize = 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | '2xl';

interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  /** Путь фотографии от API (`/api/v1/avatars/...`) или абсолютный URL; null — инициалы. */
  src?: string | null;
  /** null — размеры задаёт className (для мест с собственной сеткой). */
  size?: AvatarSize | null;
  /** Фон и цвет инициалов — видны, пока фото нет, не загрузилось или ещё грузится. */
  fallbackClassName?: string;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-[11.5px]',
  base: 'h-9 w-9 text-[13px]',
  md: 'h-10 w-10 text-[12.5px]',
  lg: 'h-11 w-11 text-[15px]',
  xl: 'h-20 w-20 text-[26px]',
  '2xl': 'h-28 w-28 text-[34px]',
};

/**
 * Единая аватарка: фото, если оно есть, иначе инициалы. Инициалы рисуются всегда
 * и лежат под картинкой — пока фото грузится или если оно не открылось, человек
 * видит буквы, а не пустой круг; загруженное фото плавно проявляется поверх.
 */
export function Avatar({
  name,
  src = null,
  size = 'md',
  className = '',
  fallbackClassName = 'bg-brand-soft text-brand',
  ...rest
}: AvatarProps): JSX.Element {
  const url = resolveAvatarUrl(src);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const showImage = url !== null && failedUrl !== url;

  return (
    <span
      {...rest}
      aria-hidden="true"
      className={`relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold ${size === null ? '' : SIZE_CLASSES[size]} ${fallbackClassName} ${className}`}
    >
      {initialsOf(name)}
      {showImage ? (
        <img
          key={url}
          src={url}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          onLoad={() => { setLoadedUrl(url); }}
          onError={() => { setFailedUrl(url); }}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${loadedUrl === url ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : null}
    </span>
  );
}
