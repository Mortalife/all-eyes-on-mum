import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

type BaseLayoutProps = {
  title: string;
  children: HtmlEscapedString | Promise<HtmlEscapedString>;
};

// Base HTML layout with Datastar and Tailwind
export const BaseLayout = ({ title, children }: BaseLayoutProps) => {
  return html`
    <!doctype html>
    <html lang="en" data-theme="light">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        <link rel="stylesheet" href="/dist/main.css" />
        <script
          type="module"
          src="https://cdn.jsdelivr.net/npm/@starfederation/datastar@1.0.0-beta.11/dist/datastar.min.js"
        ></script>
      </head>
      <body class="min-h-screen bg-base-200">
        ${children}
      </body>
    </html>
  `;
};
