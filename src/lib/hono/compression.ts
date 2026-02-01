import type { MiddlewareHandler } from "hono";
import { compress } from "hono/compress";

// Compression middleware that handles gzip/brotli based on Accept-Encoding
export const compressionMiddleware: MiddlewareHandler = compress();
