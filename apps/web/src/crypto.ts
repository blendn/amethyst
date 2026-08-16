import { argon2id } from "hash-wasm";
import type { KdfParams, KeyBundle } from "@amethyst/protocol";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

async function hkdf(root: Uint8Array<ArrayBuffer>, info: string): Promise<Uint8Array<ArrayBuffer>> {
  const material = await crypto.subtle.importKey("raw", root, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: encoder.encode(info) },
    material,
    256,
  );
  return new Uint8Array(bits);
}

export type DerivedKeys = {
  keyEncryptionKey: Uint8Array<ArrayBuffer>;
  loginSecret: string;
};

export async function deriveKeys(
  masterPassword: string,
  salt: string,
  params: KdfParams,
): Promise<DerivedKeys> {
  const root = await argon2id({
    password: masterPassword,
    salt: base64UrlToBytes(salt),
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memoryKiB,
    hashLength: params.hashLength,
    outputType: "binary",
  });
  const rootBytes = new Uint8Array(root);
  const [keyEncryptionKey, loginSecretBytes] = await Promise.all([
    hkdf(rootBytes, "amethyst/v1/key-encryption"),
    hkdf(rootBytes, "amethyst/v1/authentication"),
  ]);
  rootBytes.fill(0);
  return { keyEncryptionKey, loginSecret: bytesToBase64Url(loginSecretBytes) };
}

function keyBundleAad(userId: string, salt: string, params: KdfParams): Uint8Array<ArrayBuffer> {
  return encoder.encode(JSON.stringify([
    "amethyst-key-bundle",
    1,
    userId,
    "argon2id-v1.3",
    params.memoryKiB,
    params.iterations,
    params.parallelism,
    params.hashLength,
    salt,
  ]));
}

export async function createVaultKeyBundle(
  keyEncryptionKey: Uint8Array<ArrayBuffer>,
  userId: string,
  salt: string,
  params: KdfParams,
): Promise<{ vaultKey: CryptoKey; keyBundle: KeyBundle }> {
  const rawVaultKey = randomBytes(32);
  const vaultKey = await crypto.subtle.importKey("raw", rawVaultKey, "AES-GCM", false, ["encrypt", "decrypt"]);
  const wrappingKey = await crypto.subtle.importKey("raw", keyEncryptionKey, "AES-GCM", false, ["encrypt"]);
  const nonce = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: keyBundleAad(userId, salt, params), tagLength: 128 },
    wrappingKey,
    rawVaultKey,
  );
  rawVaultKey.fill(0);
  return {
    vaultKey,
    keyBundle: { version: 1, nonce: bytesToBase64Url(nonce), ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)) },
  };
}

export async function unwrapVaultKey(
  keyEncryptionKey: Uint8Array<ArrayBuffer>,
  userId: string,
  salt: string,
  params: KdfParams,
  bundle: KeyBundle,
): Promise<CryptoKey> {
  const wrappingKey = await crypto.subtle.importKey("raw", keyEncryptionKey, "AES-GCM", false, ["decrypt"]);
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
  return crypto.subtle.importKey("raw", rawVaultKey, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export type VaultEntry = {
  schemaVersion: 1;
  objectType: "login";
  objectId: string;
  name: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  favorite: boolean;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VaultFolder = {
  schemaVersion: 1;
  objectType: "folder";
  objectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type VaultObject = VaultEntry | VaultFolder;

function objectAad(userId: string, objectId: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(JSON.stringify(["amethyst-vault-object", 1, userId, objectId, 1]));
}

export async function encryptVaultObject(vaultKey: CryptoKey, userId: string, object: VaultObject) {
  const nonce = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: objectAad(userId, object.objectId), tagLength: 128 },
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
    parsed.schemaVersion !== 1
    || (parsed.objectType !== "login" && parsed.objectType !== "folder")
    || parsed.objectId !== envelope.id
  ) {
    throw new Error("Invalid encrypted vault object.");
  }
  if (parsed.objectType === "login") return { ...parsed, folderId: parsed.folderId ?? null };
  return parsed;
}

export const encryptEntry = encryptVaultObject;

export async function decryptEntry(
  vaultKey: CryptoKey,
  userId: string,
  envelope: { id: string; nonce: string; ciphertext: string },
): Promise<VaultEntry> {
  const object = await decryptVaultObject(vaultKey, userId, envelope);
  if (object.objectType !== "login") throw new Error("Vault object is not a login entry.");
  return object;
}

export function generatePassword(length = 20): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+";
  const limit = 256 - (256 % alphabet.length);
  let password = "";
  while (password.length < length) {
    const values = randomBytes(length);
    for (const value of values) {
      if (value < limit && password.length < length) password += alphabet[value % alphabet.length];
    }
  }
  return password;
}
