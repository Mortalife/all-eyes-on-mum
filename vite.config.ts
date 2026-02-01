import tailwindcss from "@tailwindcss/vite";
import { globSync } from "glob";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: "dist-public",
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
