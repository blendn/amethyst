import { argon2id } from "hash-wasm";
import type { KdfParams } from "@amethyst/protocol";
import { base64UrlToBytes, bytesToBase64Url, encoder } from "./encoding";

async function hkdf(
  root: Uint8Array<ArrayBuffer>,
  info: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const material = await crypto.subtle.importKey("raw", root, "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(32),
      info: encoder.encode(info),
    },
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
  return {
    keyEncryptionKey,
    loginSecret: bytesToBase64Url(loginSecretBytes),
  };
}
