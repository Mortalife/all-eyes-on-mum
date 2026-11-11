import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { getCssPath } from "../../lib/vite-manifest.ts";

// Vendored from https://github.com/starfederation/datastar/releases/tag/v1.0.5 (public/ is copied to dist-public by Vite)
export const DATASTAR_URL = "/dist/datastar-1.0.5.js";

type BaseLayoutProps = {
  title: string;
  children: HtmlEscapedString | Promise<HtmlEscapedString>;
};

// Base HTML layout with Datastar and Tailwind
export const BaseLayout = ({ title, children }: BaseLayoutProps) => {
  const cssPath = getCssPath();
  return html`
    <!doctype html>
    <html lang="en" data-theme="light">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        ${cssPath ? html`<link rel="stylesheet" href="${cssPath}" />` : ""}
        <script type="module" src="${DATASTAR_URL}"></script>
      </head>
      <body class="min-h-screen bg-base-200">
        ${children}
      </body>
    </html>
  `;
};
