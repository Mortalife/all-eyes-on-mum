import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

type CardProps = {
  children: HtmlEscapedString | Promise<HtmlEscapedString>;
  variant?: "default" | "bordered";
  class?: string;
};

// Renders a card container
export const Card = ({
  children,
  variant = "default",
  class: className = "",
}: CardProps) => {
  const variantClasses = {
    default: "bg-base-100 shadow-xl",
    bordered: "bg-base-100 border border-base-300",
  };

  return html`
    <div class="card ${variantClasses[variant]} ${className}">${children}</div>
  `;
};
