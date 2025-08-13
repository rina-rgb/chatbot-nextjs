/** @type {import('postcss-load-config').Config} */
export default {
  // Nesting must come BEFORE Tailwind so nested selectors are expanded first
  plugins: {
    'postcss-nesting': {},
    tailwindcss: {},
    autoprefixer: {},
  },
};
