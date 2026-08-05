/** Тип overlay, зарегистрированного в общем стеке OverlayProvider. */
export type OverlayType = 'modal' | 'drawer' | 'confirm' | 'popover' | 'menu' | 'tooltip';

export interface OverlayRegistration {
  id: string;
  type: OverlayType;
  /** Реагирует ли этот overlay на Escape — во время submitting передаём false. */
  closeOnEscape: boolean;
  onClose: () => void;
}

/** Добавляет запись в конец стека (topmost) без дублирования по `id`. */
export function pushOverlay(stack: OverlayRegistration[], entry: OverlayRegistration): OverlayRegistration[] {
  return [...stack.filter((item) => item.id !== entry.id), entry];
}

/** Заменяет запись на месте — не двигает overlay в стеке (в отличие от pushOverlay). */
export function updateOverlayInPlace(stack: OverlayRegistration[], entry: OverlayRegistration): OverlayRegistration[] {
  return stack.map((item) => (item.id === entry.id ? entry : item));
}

export function removeOverlay(stack: OverlayRegistration[], id: string): OverlayRegistration[] {
  return stack.filter((item) => item.id !== id);
}

export function topmostOverlay(stack: OverlayRegistration[]): OverlayRegistration | null {
  return stack.length > 0 ? stack[stack.length - 1] : null;
}
