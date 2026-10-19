import type { ComponentProps } from 'react';

import { Avatar } from '../../shared/ui/Avatar';
import { useAvatarUrl } from './useAvatarUrl';

type UserAvatarProps = Omit<ComponentProps<typeof Avatar>, 'src'> & {
  /** Чьё фото показать; без id — только инициалы. */
  userId: string | null | undefined;
};

/** Аватарка конкретного человека: сама находит его фото и обновляется в realtime. */
export function UserAvatar({ userId, ...props }: UserAvatarProps): JSX.Element {
  return <Avatar {...props} src={useAvatarUrl(userId)} />;
}
