export default {
  "content": [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  "theme": {
    "screens": {
      "sm": "576px",
      "md": "768px",
      "lg": "992px",
      "xl": "1200px",
      "xxl": "1400px",
      "query1": {
        "raw": "(max-width: 760px)"
      },
      "query2": {
        "raw": "(max-width: 600px)"
      },
      "query3": {
        "raw": "(max-width: 640px)"
      },
      "query4": {
        "raw": "(max-width: 680px)"
      }
    },
    "extend": {
      "colors": {
        "accent": "var(--sw-accent)",
        "surface": "var(--sw-surface)",
        "ink": "var(--sw-text)",
        "muted": "var(--sw-text-secondary)"
      }
    }
  },
  "corePlugins": {
    "preflight": false
  },
  "plugins": []
};
