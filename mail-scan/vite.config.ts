import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
      "@background": resolve(__dirname, "src/background"),
      "@content": resolve(__dirname, "src/content"),
      "@popup": resolve(__dirname, "src/popup"),
    },
  },
});
