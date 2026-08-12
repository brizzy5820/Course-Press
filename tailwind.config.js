/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Light theme - Premium neutrals inspired by Selar
        ink: '#0F172A',           // Deep slate for text
        cream: '#FAFAF9',         // Soft off-white background
        parchment: '#F5F5F4',     // Subtle surface color
        canvas: '#FFFFFF',        // Pure white for cards
        border: '#E7E5E4',        // Soft borders

        // Dark theme - Deep blacks with proper contrast
        spine: '#09090B',         // True deep black
        spineLight: '#18181B',    // Elevated surfaces
        spineMid: '#27272A',      // Interactive elements
        borderDark: '#3F3F46',    // Dark borders

        // Accent colors - Both themes
        gold: '#F59E0B',          // Vibrant amber
        goldDeep: '#D97706',      // Deeper amber
        goldLight: '#FEF3C7',     // Light amber tint
        sage: '#10B981',          // Fresh emerald
        sageDeep: '#059669',      // Deep emerald
        ash: '#71717A',           // Neutral gray
        ashLight: '#A1A1AA',      // Light gray
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
