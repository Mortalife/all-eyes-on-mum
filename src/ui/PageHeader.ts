import { html } from "hono/html";

type PageHeaderProps = {
  title: string;
  description?: string;
};

// Renders a page header with title and optional description
export const PageHeader = ({ title, description }: PageHeaderProps) => {
  return html`
    <div class="mb-8">
      <h1 class="text-3xl font-bold">${title}</h1>
      ${description ? html`<p class="text-base-content/60 mt-2">${description}</p>` : ""}
    </div>
  `;
};
