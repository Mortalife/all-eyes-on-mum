import { html } from "hono/html";

type AlertProps = {
  type: "success" | "error" | "info" | "warning";
  title?: string;
  message: string;
};

// Renders an alert message
export const Alert = ({ type, title, message }: AlertProps) => {
  const typeClasses = {
    success: "alert-success",
    error: "alert-error",
    info: "alert-info",
    warning: "alert-warning",
  };

  return html`
    <div class="alert ${typeClasses[type]}" role="alert">
      <div>
        ${title ? html`<strong>${title}</strong>` : ""}
        <span>${message}</span>
      </div>
    </div>
  `;
};
