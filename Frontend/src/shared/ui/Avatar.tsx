import type { HTMLAttributes } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  size?: AvatarSize;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-[11.5px]',
  md: 'h-10 w-10 text-[12.5px]',
  lg: 'h-11 w-11 text-[15px]',
};

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Единая инициал-аватарка — заменяет повторяющийся inline-паттерн (span + initialsOf), скопированный по разным страницам. */
export function Avatar({ name, size = 'md', className = '', ...rest }: AvatarProps): JSX.Element {
  return (
    <span
      {...rest}
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand ${SIZE_CLASSES[size]} ${className}`}
    >
      {initialsOf(name)}
    </span>
  );
}
