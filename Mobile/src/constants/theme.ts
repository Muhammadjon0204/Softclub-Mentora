/**
 * RAVAND colours — the same values as the web app's `Frontend/src/index.css` (light `:root`, dark
 * `[data-theme='dark']`), so the app and the site read as one product. Native system font.
 */
export const Colors = {
  light: {
    background: '#f7f8fc',
    surface: '#ffffff',
    surfaceMuted: '#f3f5fa',
    text: '#061a3d',
    textSecondary: '#475467',
    textMuted: '#5f6a82',
    border: '#e7eaf2',
    divider: '#edf0f5',
    brand: '#027095',
    brandSoft: '#e7f3f6',
    onBrand: '#ffffff',
    danger: '#c2410c',
    dangerSoft: '#fdeee6',
    warning: '#b45309',
    warningSoft: '#fdf4e3',
    success: '#15803d',
    successSoft: '#e8f6ee',
  },
  dark: {
    background: '#0b1b3a',
    surface: '#122a52',
    surfaceMuted: '#16305c',
    text: '#eaf1f8',
    textSecondary: '#a9b9d6',
    textMuted: '#8092b8',
    border: '#1e3561',
    divider: '#16294e',
    brand: '#01c6be',
    brandSoft: '#0f3a45',
    onBrand: '#04212a',
    danger: '#ff8a65',
    dangerSoft: '#3a1f1a',
    warning: '#f5b84a',
    warningSoft: '#3a2c12',
    success: '#3ecf8e',
    successSoft: '#122a20',
  },
} as const;

export type Palette = { [K in keyof typeof Colors.light]: string };

export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 6, md: 10, lg: 14 } as const;
