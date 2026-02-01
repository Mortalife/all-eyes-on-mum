import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

type ManifestEntry = {
  file: string;
  src?: string;
  css?: string[];
  isEntry?: boolean;
};

type Manifest = Record<string, ManifestEntry>;

let cachedManifest: Manifest | null = null;

const manifestPath = join(process.cwd(), "dist-public/.vite/manifest.json");

/**
 * Loads and caches the Vite manifest file.
 */
function loadManifest(): Manifest {
  if (cachedManifest && process.env.NODE_ENV === "production") {
    return cachedManifest;
  }

  if (!existsSync(manifestPath)) {
    console.warn("Vite manifest not found. Run `pnpm build:css` first.");
    return {};
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest;
  cachedManifest = manifest;
  return manifest;
}

/**
 * Gets the hashed asset path for a given entry name from the Vite manifest.
 */
export function getAssetPath(entryName: string): string | null {
  const manifest = loadManifest();
  const entry = manifest[entryName];

  if (!entry) {
    return null;
  }

  return `/dist/${entry.file}`;
}
export function getAssetPathWithCss(
  entryName: string,
): [string, string[]] | null {
  const manifest = loadManifest();
  const entry = manifest[entryName];

  if (!entry) {
    return null;
  }

  return [
    `/dist/${entry.file}`,
    (entry.css ?? []).map((path) => `/dist/${path}`),
  ];
}

/**
 * Gets the hashed CSS path for the main stylesheet.
 */
export function getCssPath(): string | null {
  return getAssetPath("src/assets/main.css");
}

/**
 * Gets the hashed CSS path for the main stylesheet.
 */
export function getJsPath(): string | null {
  return getAssetPath("src/assets/main.ts");
}
