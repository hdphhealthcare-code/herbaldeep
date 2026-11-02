const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        surface: token('surface'),
        'surface-muted': token('surface-muted'),
        border: token('border'),
        foreground: token('foreground'),
        muted: token('muted'),
        primary: token('primary'),
        'primary-hover': token('primary-hover'),
        'primary-foreground': token('primary-foreground'),
        'primary-soft': token('primary-soft'),
        sidebar: token('sidebar'),
        'sidebar-foreground': token('sidebar-foreground'),
        'sidebar-active': token('sidebar-active'),
        success: token('success'),
        'success-soft': token('success-soft'),
        warning: token('warning'),
        'warning-soft': token('warning-soft'),
        danger: token('danger'),
        'danger-soft': token('danger-soft'),
        info: token('info'),
        'info-soft': token('info-soft'),
        overlay: token('overlay'),
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.06), 0 4px 16px rgb(var(--shadow) / 0.05)',
        pop: '0 12px 40px rgb(var(--shadow) / 0.2)',
      },
    },
  },
  plugins: [],
};
