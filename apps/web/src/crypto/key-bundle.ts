import type { KdfParams, KeyBundle } from "@amethyst/protocol";
import { base64UrlToBytes, bytesToBase64Url, encoder } from "./encoding";
import { randomBytes } from "./random";

function keyBundleAad(
  userId: string,
  salt: string,
  params: KdfParams,
): Uint8Array<ArrayBuffer> {
  return encoder.encode(
    JSON.stringify([
      "amethyst-key-bundle",
      1,
      userId,
      "argon2id-v1.3",
      params.memoryKiB,
      params.iterations,
      params.parallelism,
      params.hashLength,
      salt,
    ]),
  );
}

export async function createVaultKeyBundle(
  keyEncryptionKey: Uint8Array<ArrayBuffer>,
  userId: string,
  salt: string,
  params: KdfParams,
): Promise<{ vaultKey: CryptoKey; keyBundle: KeyBundle }> {
  const rawVaultKey = randomBytes(32);
  const vaultKey = await crypto.subtle.importKey(
    "raw",
    rawVaultKey,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
  const wrappingKey = await crypto.subtle.importKey(
    "raw",
    keyEncryptionKey,
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const nonce = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData: keyBundleAad(userId, salt, params),
      tagLength: 128,
    },
    wrappingKey,
    rawVaultKey,
  );
  rawVaultKey.fill(0);
  return {
    vaultKey,
    keyBundle: {
      version: 1,
      nonce: bytesToBase64Url(nonce),
      ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    },
  };
}

export async function unwrapVaultKey(
  keyEncryptionKey: Uint8Array<ArrayBuffer>,
  userId: string,
  salt: string,
  params: KdfParams,
  bundle: KeyBundle,
): Promise<CryptoKey> {
  const wrappingKey = await crypto.subtle.importKey(
    "raw",
    keyEncryptionKey,
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const rawVaultKey = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64UrlToBytes(bundle.nonce),
      additionalData: keyBundleAad(userId, salt, params),
      tagLength: 128,
    },
    wrappingKey,
    base64UrlToBytes(bundle.ciphertext),
  );
  return crypto.subtle.importKey("raw", rawVaultKey, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
