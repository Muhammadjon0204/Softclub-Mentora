/**
 * @deprecated Совместимость: старый API (`trigger`/`children` render-props,
 * `align="left"|"right"`) теперь реализован в `shared/overlays/Popover` —
 * portal, overlay stack, focus return, flip/clamp. Для нового кода
 * импортируйте `Popover`/`MenuItem` напрямую из `../../shared/overlays`.
 */
export { Popover, MenuItem } from '../overlays';
export type { PopoverProps, PopoverTriggerRenderProps } from '../overlays';
