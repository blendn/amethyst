import { z } from "zod";

export const DEMO_WARNING =
  "Educational prototype — do not store real credentials.";

export const kdfParamsSchema = z.object({
  memoryKiB: z.number().int().min(19_456).max(262_144),
  iterations: z.number().int().min(2).max(10),
  parallelism: z.number().int().min(1).max(4),
  hashLength: z.literal(32),
});

export const keyBundleSchema = z.object({
  version: z.literal(1),
  nonce: z.string().min(1),
  ciphertext: z.string().min(1),
});

export type KdfParams = z.infer<typeof kdfParamsSchema>;
export type KeyBundle = z.infer<typeof keyBundleSchema>;
