import type { HonoRequest } from "hono";
import { raw, type HtmlEscapedString } from "hono/utils/html";

// Checks if request is a Datastar SSE request
export const isDatastarSSERequest = (req: HonoRequest) => {
  const accept = req.header("Accept")?.split(", ");
  const datastar = req.header("Datastar-Request");

  return (
    datastar === "true" || accept?.some((type) => type === "text/event-stream")
  );
};

// Creates a patch element SSE event
export const patchElementEvent = (
  html: HtmlEscapedString | Promise<HtmlEscapedString>,
): string => {
  const htmlString = typeof html === "string" ? html : html.toString();
  const lines = htmlString.split("\n").map((line) => `data: elements ${line}`);
  return `event: datastar-patch-elements\n${lines.join("\n")}\n\n`;
};

// Creates a redirect SSE event
export const redirectFragmentEvent = (url: string): string => {
  return executeScriptEvent(`window.location.href = "${url}"`);
};

// Creates a signal update SSE event
export const setSignalEvent = (key: string, value: unknown): string => {
  return `event: datastar-patch-signals\ndata: signals ${JSON.stringify({ [key]: value })}\n\n`;
};

// Creates an execute script SSE event
export const executeScriptEvent = (script: string): string => {
  return `event: datastar-patch-elements\ndata: mode append\ndata: selector body\ndata: elements <script>${script}</script>\n\n`;
};

// Helper to send element patch via stream
export const sendElement = async (
  stream: WritableStreamDefaultWriter<Uint8Array>,
  html: HtmlEscapedString | Promise<HtmlEscapedString>,
) => {
  const encoder = new TextEncoder();
  await stream.write(encoder.encode(patchElementEvent(html)));
};

// Helper to send redirect via stream
export const sendRedirect = async (
  stream: WritableStreamDefaultWriter<Uint8Array>,
  url: string,
) => {
  const encoder = new TextEncoder();
  await stream.write(encoder.encode(redirectFragmentEvent(url)));
};

// Helper to send signal update via stream
export const sendSignal = async (
  stream: WritableStreamDefaultWriter<Uint8Array>,
  key: string,
  value: unknown,
) => {
  const encoder = new TextEncoder();
  await stream.write(encoder.encode(setSignalEvent(key, value)));
};

// Helper to send script execution via stream
export const sendScript = async (
  stream: WritableStreamDefaultWriter<Uint8Array>,
  script: string,
) => {
  const encoder = new TextEncoder();
  await stream.write(encoder.encode(executeScriptEvent(script)));
};
