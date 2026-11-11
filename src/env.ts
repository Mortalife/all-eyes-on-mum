import { z } from "zod";

const envSchema = z
  .object({
    PORT: z.coerce.number().default(3000),
    BASE_URL: z.string().default("http://localhost:3000"),
    DATABASE_PATH: z.string().optional(),
    NODE_ENV: z.string().optional(),
    ORIGIN_SECRET: z.string().optional(),
    ADMIN_EMAIL: z.email("ADMIN_EMAIL must be a valid email"),
    // Phone push notifications are disabled unless both keys are set
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
  })
  .refine(
    (config) =>
      config.NODE_ENV !== "production" || Boolean(config.ORIGIN_SECRET?.trim()),
    {
      path: ["ORIGIN_SECRET"],
      message: "ORIGIN_SECRET is required in production",
    },
  );

export const env = envSchema.parse(process.env);

export const IS_DEV = env.NODE_ENV === "development";
export const IS_PROD = env.NODE_ENV === "production";
export const IS_TEST = env.NODE_ENV === "test";
