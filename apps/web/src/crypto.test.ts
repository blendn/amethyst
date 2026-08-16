import { describe, expect, it } from "vitest";
import {
  createVaultKeyBundle,
  decryptEntry,
  decryptVaultObject,
  deriveKeys,
  encryptEntry,
  encryptVaultObject,
  generatePassword,
  unwrapVaultKey,
  type VaultEntry,
} from "./crypto";

const params = { memoryKiB: 19_456, iterations: 2, parallelism: 1, hashLength: 32 } as const;
const salt = "MDEyMzQ1Njc4OWFiY2RlZg";
const userId = "8f1f7ab5-cf00-4ca6-b27d-ef5baaa49a54";

describe("browser cryptography", () => {
  it("derives separated keys and unwraps an encrypted vault key", async () => {
    const keys = await deriveKeys("correct horse battery staple", salt, params);
    expect(keys.loginSecret).not.toBe("");
    expect(keys.keyEncryptionKey).toHaveLength(32);
    const { vaultKey, keyBundle } = await createVaultKeyBundle(keys.keyEncryptionKey, userId, salt, params);
    const unwrapped = await unwrapVaultKey(keys.keyEncryptionKey, userId, salt, params, keyBundle);

    const entry: VaultEntry = {
      schemaVersion: 1,
      objectType: "login",
      objectId: "abce4499-a33a-4401-bcad-e7a142724283",
      name: "Example",
      username: "demo@example.com",
      password: "not-a-real-password",
      url: "https://example.com",
      notes: "Encrypted locally",
      favorite: false,
      folderId: null,
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-06T00:00:00.000Z",
    };
    const encrypted = await encryptEntry(vaultKey, userId, entry);
    await expect(decryptEntry(unwrapped, userId, encrypted)).resolves.toEqual(entry);
  }, 20_000);

  it("rejects an object under the wrong account AAD", async () => {
    const keys = await deriveKeys("correct horse battery staple", salt, params);
    const { vaultKey } = await createVaultKeyBundle(keys.keyEncryptionKey, userId, salt, params);
    const entry: VaultEntry = {
      schemaVersion: 1, objectType: "login", objectId: crypto.randomUUID(), name: "Test",
      username: "", password: "secret", url: "", notes: "", favorite: false,
      folderId: null,
      createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
    };
    const encrypted = await encryptEntry(vaultKey, userId, entry);
    await expect(decryptEntry(vaultKey, "8b04459a-b2de-4ff0-a2af-d66248c45aa1", encrypted)).rejects.toThrow();
  }, 20_000);

  it("encrypts folder names as opaque vault objects", async () => {
    const keys = await deriveKeys("correct horse battery staple", salt, params);
    const { vaultKey } = await createVaultKeyBundle(keys.keyEncryptionKey, userId, salt, params);
    const folder = {
      schemaVersion: 1 as const,
      objectType: "folder" as const,
      objectId: crypto.randomUUID(),
      name: "Work accounts",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
    const encrypted = await encryptVaultObject(vaultKey, userId, folder);
    expect(encrypted.ciphertext).not.toContain(folder.name);
    await expect(decryptVaultObject(vaultKey, userId, encrypted)).resolves.toEqual(folder);
  }, 20_000);

  it("generates passwords using the requested length", () => {
    const first = generatePassword(24);
    const second = generatePassword(24);
    expect(first).toHaveLength(24);
    expect(second).toHaveLength(24);
    expect(first).not.toBe(second);
  });
});
