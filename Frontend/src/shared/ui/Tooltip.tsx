/**
 * @deprecated Совместимость: старый `{content, children}` API теперь реализован
 * в `shared/overlays/Tooltip` — portal, position:fixed, collision detection,
 * задержка открытия/закрытия. Для нового кода импортируйте `Tooltip` напрямую
 * из `../../shared/overlays`.
 */
export { Tooltip } from '../overlays';
export type { TooltipProps } from '../overlays';
