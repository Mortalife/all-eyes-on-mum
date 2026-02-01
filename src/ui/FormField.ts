import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

type FormFieldProps = {
  label: string;
  htmlFor: string;
  children: HtmlEscapedString | Promise<HtmlEscapedString>;
  error?: string;
};

// Renders a form field with label and optional error
export const FormField = ({
  label,
  htmlFor,
  children,
  error,
}: FormFieldProps) => {
  return html`
    <div class="form-control w-full">
      <label class="label" for="${htmlFor}">
        <span class="label-text">${label}</span>
      </label>
      ${children}
      ${error
        ? html`<label class="label">
            <span class="label-text-alt text-error">${error}</span>
          </label>`
        : ""}
    </div>
  `;
};
