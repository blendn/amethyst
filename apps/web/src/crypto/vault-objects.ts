import {
  base64UrlToBytes,
  bytesToBase64Url,
  decoder,
  encoder,
} from "./encoding";
import { randomBytes } from "./random";
import type { VaultEntry, VaultObject } from "./types";

function objectAad(userId: string, objectId: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(
    JSON.stringify(["amethyst-vault-object", 1, userId, objectId, 1]),
  );
}

export async function encryptVaultObject(
  vaultKey: CryptoKey,
  userId: string,
  object: VaultObject,
) {
  const nonce = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData: objectAad(userId, object.objectId),
      tagLength: 128,
    },
    vaultKey,
    encoder.encode(JSON.stringify(object)),
  );
  return {
    id: object.objectId,
    version: 1 as const,
    nonce: bytesToBase64Url(nonce),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  };
}

export async function decryptVaultObject(
  vaultKey: CryptoKey,
  userId: string,
  envelope: { id: string; nonce: string; ciphertext: string },
): Promise<VaultObject> {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64UrlToBytes(envelope.nonce),
      additionalData: objectAad(userId, envelope.id),
      tagLength: 128,
    },
    vaultKey,
    base64UrlToBytes(envelope.ciphertext),
  );
  const parsed = JSON.parse(decoder.decode(plaintext)) as VaultObject;
  if (
    parsed.schemaVersion !== 1 ||
    (parsed.objectType !== "login" && parsed.objectType !== "folder") ||
    parsed.objectId !== envelope.id
  ) {
    throw new Error("Invalid encrypted vault object.");
  }
  if (parsed.objectType === "login") {
    return { ...parsed, folderId: parsed.folderId ?? null };
  }
  return parsed;
}

export const encryptEntry = encryptVaultObject;

export async function decryptEntry(
  vaultKey: CryptoKey,
  userId: string,
  envelope: { id: string; nonce: string; ciphertext: string },
): Promise<VaultEntry> {
  const object = await decryptVaultObject(vaultKey, userId, envelope);
  if (object.objectType !== "login") {
    throw new Error("Vault object is not a login entry.");
  }
  return object;
}
