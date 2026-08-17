import { z } from "zod";

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

export const updateVaultObjectSchema = createVaultObjectSchema
  .omit({ id: true })
  .extend({
    expectedRevision: z.number().int().nonnegative(),
  });

export const deleteVaultObjectSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
});

export type VaultEnvelope = z.infer<typeof vaultEnvelopeSchema>;
