/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./{app,components,libs,pages,hooks}/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      black: '#000000',
      white: '#ffffff',
      // Map existing blue-* utility usage to the new brand system.
      blue: {
        50: '#F1E8DC',   // sand
        100: '#F6EDE3',  // cream
        200: '#EED6CF',
        300: '#E8C5BE',  // rose
        400: '#E5B65A',
        500: '#D9A441',  // saffron
        600: '#B8862C',
        700: '#7A1F2E',  // wine accent
        800: '#4A1520',  // oxblood
        900: '#2B0B12',  // wine
      },
      gray: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827',
      },
      red: {
        50: '#fef2f2',
        100: '#fee2e2',
        200: '#fecaca',
        300: '#fca5a5',
        400: '#f87171',
        500: '#ef4444',
        600: '#dc2626',
        700: '#b91c1c',
        800: '#991b1b',
        900: '#7f1d1d',
      },
      green: {
        50: '#f0fdf4',
        100: '#dcfce7',
        200: '#bbf7d0',
        300: '#86efac',
        400: '#4ade80',
        500: '#22c55e',
        600: '#16a34a',
        700: '#15803d',
        800: '#166534',
        900: '#14532d',
      },
      yellow: {
        50: '#fefce8',
        100: '#fef9c3',
        200: '#fef08a',
        300: '#fde047',
        400: '#facc15',
        500: '#eab308',
        600: '#ca8a04',
        700: '#a16207',
        800: '#854d0e',
        900: '#713f12',
      },
      amber: {
        50: '#fffbeb',
        100: '#fef3c7',
        200: '#fde68a',
        300: '#fcd34d',
        400: '#fbbf24',
        500: '#f59e0b',
        600: '#d97706',
        700: '#b45309',
        800: '#92400e',
        900: '#78350f',
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Bodoni Moda"', 'Didot', 'Georgia', 'serif'],
        handwriting: ['Pacifico', 'cursive'],
        accent: ['"Great Vibes"', 'cursive'],
      },
      colors: {
        brand: {
          gold: '#D9A441',
          black: '#2B0B12',
          ivory: '#F1E8DC',
          champagne: '#E8C5BE',
          nude: '#E8C5BE',
          brown: '#4A1520',
          DEFAULT: '#D9A441',
          light: '#E8C5BE',
          dark: '#4A1520',
          accent: '#E8C5BE',
          muted: '#F1E8DC',
          wine: '#2B0B12',
          oxblood: '#4A1520',
          sand: '#F1E8DC',
          paper: '#FBF6EF',
          cream: '#F6EDE3',
          saffron: '#D9A441',
          rose: '#E8C5BE',
          ink: '#1F1115',
          muted2: '#6B565B',
        },
      },
    },
  },
  plugins: [],
}

