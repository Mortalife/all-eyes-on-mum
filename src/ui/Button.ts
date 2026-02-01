import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

type ButtonProps = {
  children: HtmlEscapedString | Promise<HtmlEscapedString> | string;
  variant?: "primary" | "secondary" | "ghost" | "error";
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit" | "reset";
  href?: string;
  disabled?: boolean;
  class?: string;
};

// Renders a button or link styled as a button
export const Button = ({
  children,
  variant = "primary",
  size = "md",
  type = "button",
  href,
  disabled = false,
  class: className = "",
}: ButtonProps) => {
  const variantClasses = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    ghost: "btn-ghost",
    error: "btn-error",
  };

  const sizeClasses = {
    sm: "btn-sm",
    md: "",
    lg: "btn-lg",
  };

  const classes =
    `btn ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim();

  if (href) {
    return html`<a href="${href}" class="${classes}">${children}</a>`;
  }

  return html`
    <button type="${type}" class="${classes}" ${disabled ? "disabled" : ""}>
      ${children}
    </button>
  `;
};
