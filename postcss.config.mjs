/** @type {import('postcss-load-config').Config} */
const config = {
  // Nesting must come BEFORE Tailwind so nested selectors are expanded first
  plugins: {
    'tailwindcss/nesting': {},
    tailwindcss: {},
  },
};

export default config;
