import { useEffect, useState } from 'react';

import { AVATAR_COLOR_EVENT, readAvatarColor } from './profilePresentation';
import type { AvatarColorId } from './profilePresentation';

/** Выбранный цвет аватара; меняется сразу во всех местах (профиль, шапка) без перезагрузки. */
export function useAvatarColor(userId: string | undefined): AvatarColorId {
  const [color, setColor] = useState<AvatarColorId>(() => (userId !== undefined ? readAvatarColor(userId) : 'indigo'));

  useEffect(() => {
    if (userId === undefined) return undefined;
    setColor(readAvatarColor(userId));
    const handler = (): void => { setColor(readAvatarColor(userId)); };
    window.addEventListener(AVATAR_COLOR_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(AVATAR_COLOR_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, [userId]);

  return color;
}
