import { z } from "zod";

export const DEMO_WARNING = "Educational prototype — do not store real credentials.";

export const kdfParamsSchema = z.object({
  memoryKiB: z.number().int().min(19_456).max(262_144),
  iterations: z.number().int().min(2).max(10),
  parallelism: z.number().int().min(1).max(4),
  hashLength: z.literal(32),
});

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

export const keyBundleSchema = z.object({
  version: z.literal(1),
  nonce: z.string().min(1),
  ciphertext: z.string().min(1),
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

export const vaultEnvelopeSchema = z.object({
  id: z.string().uuid(),
  version: z.literal(1),
  nonce: z.string().min(1),
  ciphertext: z.string().min(1).max(2_000_000),
  revision: z.number().int().nonnegative(),
  deletedAt: z.string().datetime().nullable(),
});

export const createVaultObjectSchema = vaultEnvelopeSchema.pick({
  id: true,
  version: true,
  nonce: true,
  ciphertext: true,
});

export const updateVaultObjectSchema = createVaultObjectSchema.omit({ id: true }).extend({
  expectedRevision: z.number().int().nonnegative(),
});

export const deleteVaultObjectSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
});

export type KdfParams = z.infer<typeof kdfParamsSchema>;
export type KeyBundle = z.infer<typeof keyBundleSchema>;
export type VaultEnvelope = z.infer<typeof vaultEnvelopeSchema>;

