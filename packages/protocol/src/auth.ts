import { z } from "zod";
import { kdfParamsSchema, keyBundleSchema } from "./common.js";

export const preloginRequestSchema = z.object({
  email: z.string().trim().email().max(320),
});

export const preloginResponseSchema = z.object({
  userId: z.string().uuid(),
  kdfSalt: z.string().min(1),
  kdfParams: kdfParamsSchema,
  authSchemeVersion: z.literal(1),
  registration: z.boolean(),
  registrationToken: z.string().optional(),
});

export const registerRequestSchema = z.object({
  registrationToken: z.string().min(32),
  email: z.string().trim().email().max(320),
  loginSecret: z.string().min(40).max(64),
  kdfSalt: z.string().min(1),
  kdfParams: kdfParamsSchema,
  keyBundle: keyBundleSchema,
});

export const loginRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  loginSecret: z.string().min(40).max(64),
});
