/**
 * Единая z-index шкала для всех overlays приложения. Любой новый overlay
 * обязан брать значение отсюда — раскиданные по компонентам `z-50`/`z-[9999]`
 * рано или поздно конфликтуют (nested confirm поверх Drawer, tooltip поверх Modal).
 */
export const OVERLAY_Z_INDEX = {
  dropdown: 1000,
  popover: 1100,
  menu: 1100,
  backdrop: 1200,
  drawer: 1210,
  modal: 1220,
  nestedBackdrop: 1300,
  confirm: 1310,
  toast: 1400,
  tooltip: 1500,
  chartTooltip: 1600,
} as const;

export type OverlayZIndexLayer = keyof typeof OVERLAY_Z_INDEX;
