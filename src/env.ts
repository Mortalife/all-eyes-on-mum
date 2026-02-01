import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  BASE_URL: z.string().default("http://localhost:3000"),
  DATABASE_PATH: z.string().optional(),
  NODE_ENV: z.string().optional(),
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be a valid email"),
});

export const env = envSchema.parse(process.env);

export const IS_DEV = env.NODE_ENV === "development";
export const IS_PROD = env.NODE_ENV === "production";
export const IS_TEST = env.NODE_ENV === "test";
