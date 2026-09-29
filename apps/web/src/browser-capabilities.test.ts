import { describe, expect, it } from "vitest";
import { checkBrowserCapabilities } from "./browser-capabilities";

const supportedEnvironment = {
  isSecureContext: true,
  crypto: globalThis.crypto,
  WebAssembly,
};

describe("browser capability preflight", () => {
  it("accepts working browser primitives", async () => {
    await expect(
      checkBrowserCapabilities(supportedEnvironment),
    ).resolves.toEqual({
      supported: true,
      missing: [],
    });
  });

  it("reports an insecure context and unavailable randomness", async () => {
    const result = await checkBrowserCapabilities({
      ...supportedEnvironment,
      isSecureContext: false,
      crypto: undefined,
    });
    expect(result).toEqual({
      supported: false,
      missing: [
        "secure-context",
        "cryptographic-randomness",
        "aes-gcm",
        "hkdf",
      ],
    });
  });

  it("rejects a random API that exists but fails", async () => {
    const crypto = {
      ...supportedEnvironment.crypto,
      getRandomValues: () => {
        throw new Error("blocked");
      },
      randomUUID: () => "00000000-0000-4000-8000-000000000000",
      subtle: supportedEnvironment.crypto.subtle,
    } as Crypto;
    const result = await checkBrowserCapabilities({
      ...supportedEnvironment,
      crypto,
    });
    expect(result.missing).toContain("cryptographic-randomness");
  });

  it("checks AES-GCM and HKDF operations independently", async () => {
    const subtle = supportedEnvironment.crypto.subtle;
    const crypto = {
      getRandomValues: supportedEnvironment.crypto.getRandomValues.bind(
        supportedEnvironment.crypto,
      ),
      randomUUID: supportedEnvironment.crypto.randomUUID.bind(
        supportedEnvironment.crypto,
      ),
      subtle: {
        importKey: subtle.importKey.bind(subtle),
        encrypt: async () => {
          throw new Error("AES-GCM blocked");
        },
        decrypt: subtle.decrypt.bind(subtle),
        deriveBits: async () => {
          throw new Error("HKDF blocked");
        },
      },
    } as unknown as Crypto;
    const result = await checkBrowserCapabilities({
      ...supportedEnvironment,
      crypto,
    });
    expect(result).toEqual({
      supported: false,
      missing: ["aes-gcm", "hkdf"],
    });
  });

  it("rejects WebAssembly when its compile path fails", async () => {
    const result = await checkBrowserCapabilities({
      ...supportedEnvironment,
      WebAssembly: {
        ...WebAssembly,
        compile: async () => {
          throw new Error("blocked");
        },
      },
    });
    expect(result.missing).toContain("webassembly");
  });
});
