import type { BrowserCapability } from "../../browser-capabilities";

const capabilityNames: Record<BrowserCapability, string> = {
  "secure-context": "A secure context (HTTPS or localhost)",
  "cryptographic-randomness": "Cryptographic randomness",
  "aes-gcm": "WebCrypto AES-GCM encryption",
  hkdf: "WebCrypto HKDF key derivation",
  webassembly: "WebAssembly compilation and memory",
};

export function UnsupportedBrowser({
  missing,
}: {
  missing: BrowserCapability[];
}) {
  return (
    <section className="card center-card unsupported-browser" role="alert">
      <h1>Browser not supported</h1>
      <p>
        Amethyst cannot create an account, sign in, or unlock a vault here
        because these required capabilities are unavailable:
      </p>
      <ul>
        {missing.map((capability) => (
          <li key={capability}>{capabilityNames[capability]}</li>
        ))}
      </ul>
      <p>
        Try a current browser over HTTPS or localhost. Device compatibility
        still needs real-world Argon2id testing.
      </p>
    </section>
  );
}
