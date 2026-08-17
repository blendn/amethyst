import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  AUTH_PEPPER: z.string().min(32),
  SESSION_TTL_HOURS: z.coerce.number().positive().max(720).default(24),
});

export const config = configSchema.parse(process.env);
