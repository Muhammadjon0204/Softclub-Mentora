/**
 * Единая z-index шкала для всех overlays приложения. Любой новый overlay
 * обязан брать значение отсюда — раскиданные по компонентам `z-50`/`z-[9999]`
 * рано или поздно конфликтуют (nested confirm поверх Drawer, tooltip поверх Modal).
 */
export const OVERLAY_Z_INDEX = {
  backdrop: 1200,
  drawer: 1210,
  modal: 1220,
  nestedBackdrop: 1300,
  confirm: 1310,
  // Dropdown/popover/menu должны быть выше ЛЮБОГО overlay, из которого их могут открыть
  // (Select/SearchSelect внутри Drawer или ConfirmDialog/Modal) — иначе панель со списком
  // рендерится позади него (реальный баг: AssignBranchAdminDialog, раздел 32 промпта).
  dropdown: 1320,
  popover: 1320,
  menu: 1320,
  toast: 1400,
  tooltip: 1500,
  chartTooltip: 1600,
} as const;

export type OverlayZIndexLayer = keyof typeof OVERLAY_Z_INDEX;
