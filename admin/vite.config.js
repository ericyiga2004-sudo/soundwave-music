import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // iPhone 7 runs iOS 15: retain compatible media-query syntax in production.
  build: {
    target: ["es2020", "safari15"],
    cssTarget: "safari15",
  },
});
