import tailwindcss from "@tailwindcss/vite";
import { globSync } from "glob";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss({ optimize: false })],
  build: {
    outDir: "dist-public",
    // lightningcss drops DaisyUI's @scope relative selectors (e.g. .join z-index), esbuild keeps them
    cssMinify: "esbuild",
    manifest: true,
    rollupOptions: {
      input: Object.fromEntries(
        globSync("src/assets/**/*.{ts,css}").map((file) => {
          const name = file
            .replace(/^src\/assets\//, "")
            .replace(/\.[^.]+$/, "");
          return [name, file];
        }),
      ),
      output: {
        assetFileNames: "[name].[hash][extname]",
        entryFileNames: "[name].[hash].js",
      },
    },
  },
});
