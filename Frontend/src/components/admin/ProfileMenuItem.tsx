import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface ProfileMenuItemProps {
  icon: ReactNode;
  children: ReactNode;
  /** Есть `to` — рендерится как `<Link>`; нет — как `<button>` (например, «Выйти»). */
  to?: string;
  onClick?: () => void;
  /** Только текст/hover красные — не вся строка (раздел 5.3 задачи). */
  destructive?: boolean;
}

/** Одна строка profile dropdown: «Профиль», «Настройки», «Выйти» — без дублирования разметки. */
export function ProfileMenuItem({ icon, children, to, onClick, destructive = false }: ProfileMenuItemProps): JSX.Element {
  const className = `flex h-11 w-full items-center gap-2.5 rounded-control-sm px-3 text-left text-sm transition focus-visible:outline-none ${
    destructive
      ? 'text-danger hover:bg-danger-soft focus-visible:bg-danger-soft'
      : 'text-ink hover:bg-surface-hover focus-visible:bg-surface-hover'
  }`;

  const content = (
    <>
      <span aria-hidden="true" className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </>
  );

  if (to !== undefined) {
    return (
      <Link to={to} role="menuitem" onClick={onClick} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" role="menuitem" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
