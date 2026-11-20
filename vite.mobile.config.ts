import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Static phone bundle. No server. Tracks stay on the device. */
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: "@/lib/passages",
        replacement: resolve(import.meta.dirname, "src/lib/passages.mobile.ts"),
      },
      {
        // tide-station.ts imports "./bom-tides.ts"; the phone fetches BOM natively.
        find: /^\.\/bom-tides\.ts$/,
        replacement: resolve(import.meta.dirname, "src/lib/bom-tides.mobile.ts"),
      },
      {
        find: "@/lib/auth/gates",
        replacement: resolve(import.meta.dirname, "src/mobile-shims/auth-gates.tsx"),
      },
      {
        find: "@/lib/auth/use-current-user",
        replacement: resolve(import.meta.dirname, "src/mobile-shims/use-current-user.ts"),
      },
      {
        find: "@/lib/auth/server",
        replacement: resolve(import.meta.dirname, "src/mobile-shims/auth-server.ts"),
      },
      {
        find: "@tanstack/react-start/server",
        replacement: resolve(import.meta.dirname, "src/mobile-shims/start.ts"),
      },
      {
        find: "@tanstack/react-start",
        replacement: resolve(import.meta.dirname, "src/mobile-shims/start.ts"),
      },
      { find: "@", replacement: resolve(import.meta.dirname, "src") },
    ],
  },
  build: {
    outDir: "dist-mobile",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, "mobile.html"),
    },
  },
  publicDir: "public",
});
