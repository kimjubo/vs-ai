import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Static build for GitHub Pages. Relative base, images inlined so the site is just text files. */
export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [tailwindcss(), viteReact()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "docs",
    emptyOutDir: true,
    assetsInlineLimit: (filePath, content) => {
      if (filePath.endsWith(".wav")) return false;
      return content.length < 8_000_000;
    },
    rollupOptions: {
      input: fileURLToPath(new URL("./pages.html", import.meta.url)),
    },
  },
});
