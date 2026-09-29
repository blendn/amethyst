export type BrowserCapability =
  | "secure-context"
  | "cryptographic-randomness"
  | "aes-gcm"
  | "hkdf"
  | "webassembly";

export type BrowserCompatibility =
  | { supported: true; missing: [] }
  | { supported: false; missing: BrowserCapability[] };

type BrowserEnvironment = {
  isSecureContext?: boolean;
  crypto?: Crypto | undefined;
  WebAssembly?: typeof WebAssembly;
};

// The demo's hash-wasm Argon2id path uses compile, instantiate, and growable
// WebAssembly memory. This small probe does not allocate the account's KDF memory.
const emptyWasmModule = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);

export async function checkBrowserCapabilities(
  environment: BrowserEnvironment = globalThis,
): Promise<BrowserCompatibility> {
  const missing: BrowserCapability[] = [];
  if (environment.isSecureContext !== true) missing.push("secure-context");

  const browserCrypto = environment.crypto;
  try {
    if (!browserCrypto?.getRandomValues || !browserCrypto.randomUUID)
      throw new Error("Cryptographic randomness is unavailable.");
    browserCrypto.getRandomValues(new Uint8Array(16));
    browserCrypto.randomUUID();
  } catch {
    missing.push("cryptographic-randomness");
  }

  const subtle = browserCrypto?.subtle;
  try {
    if (!subtle) throw new Error("WebCrypto is unavailable.");
    const key = await subtle.importKey(
      "raw",
      new Uint8Array(32),
      "AES-GCM",
      false,
      ["encrypt", "decrypt"],
    );
    const iv = new Uint8Array(12);
    const plaintext = new Uint8Array([1, 2, 3]);
    const ciphertext = await subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      plaintext,
    );
    const decoded = new Uint8Array(
      await subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext),
    );
    if (
      decoded.length !== plaintext.length ||
      !decoded.every((byte, i) => byte === plaintext[i])
    )
      throw new Error("AES-GCM round trip failed.");
  } catch {
    missing.push("aes-gcm");
  }

  try {
    if (!subtle) throw new Error("WebCrypto is unavailable.");
    const key = await subtle.importKey(
      "raw",
      new Uint8Array(32),
      "HKDF",
      false,
      ["deriveBits"],
    );
    const bits = await subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(32),
        info: new Uint8Array(0),
      },
      key,
      256,
    );
    if (bits.byteLength !== 32)
      throw new Error("HKDF returned an invalid key.");
  } catch {
    missing.push("hkdf");
  }

  try {
    const wasm = environment.WebAssembly;
    if (!wasm?.compile || !wasm.instantiate || !wasm.Memory)
      throw new Error("WebAssembly is unavailable.");
    const module = await wasm.compile(emptyWasmModule);
    await wasm.instantiate(module, {});
    new wasm.Memory({ initial: 1 }).grow(1);
  } catch {
    missing.push("webassembly");
  }

  return missing.length
    ? { supported: false, missing }
    : { supported: true, missing: [] };
}
