/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Поверхности.
        app: 'var(--background)',
        'app-subtle': 'var(--background-subtle)',
        surface: {
          DEFAULT: 'var(--surface)',
          muted: 'var(--surface-muted)',
          hover: 'var(--surface-hover)',
        },
        // Текст (нейтральный — не путать с брендовым `brand`).
        ink: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          disabled: 'var(--text-disabled)',
        },
        // Границы и разделители.
        line: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        divider: 'var(--divider)',
        // Брендовый indigo — единственный акцент, используемый широко.
        brand: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          active: 'var(--primary-active)',
          soft: 'var(--primary-soft)',
          'soft-hover': 'var(--primary-soft-hover)',
        },
        // Второстепенные акценты для графиков — используются экономно (раздел 4).
        chart: {
          blue: 'var(--secondary-blue)',
          violet: 'var(--secondary-violet)',
          cyan: 'var(--secondary-cyan)',
        },
        // Статусные цвета: DEFAULT/soft/border — не более 2-3% интерфейса.
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
          border: 'var(--success-border)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          soft: 'var(--warning-soft)',
          border: 'var(--warning-border)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          soft: 'var(--danger-soft)',
          border: 'var(--danger-border)',
        },
        info: {
          DEFAULT: 'var(--info)',
          soft: 'var(--info-soft)',
          border: 'var(--info-border)',
        },
      },
      borderRadius: {
        card: '18px',
        panel: '20px',
        control: '12px',
        'control-sm': '10px',
        dropdown: '14px',
        overlay: '20px',
      },
      boxShadow: {
        // Существующая auth-тень — не трогаем (используется в компонентах входа).
        card: '0 20px 45px -20px rgba(49, 46, 129, 0.35)',
        // Тонкая тень Admin-карточек (раздел 6 промпта): без тяжёлых теней.
        surface: '0 1px 2px rgba(16, 24, 40, 0.025), 0 8px 24px rgba(20, 28, 58, 0.045)',
        'surface-hover': '0 2px 4px rgba(16, 24, 40, 0.035), 0 10px 28px rgba(20, 28, 58, 0.06)',
        popover: '0 4px 10px rgba(16, 24, 40, 0.05), 0 16px 40px rgba(20, 28, 58, 0.09)',
      },
      ringColor: {
        DEFAULT: 'var(--focus-ring)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(16px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-left-panel': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'scale-in': 'scale-in 160ms ease-out',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left-panel': 'slide-in-left-panel 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
