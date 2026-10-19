/** Инициалы и адрес фото — общие для `Avatar` и всех, кому они нужны без компонента. */

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** API отдаёт относительный путь; фронт и API могут жить на разных доменах. */
export function resolveAvatarUrl(src: string | null | undefined): string | null {
  if (src === null || src === undefined || src === '') return null;
  return src.startsWith('/') ? `${import.meta.env.VITE_API_BASE_URL ?? ''}${src}` : src;
}
