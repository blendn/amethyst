# Threat model

## Security goals

Amethyst aims to provide:

1. **Vault confidentiality:** the API, database, backups, and operators cannot
   decrypt vault objects without guessing the user's master password.
2. **Vault integrity:** modification, substitution, or cross-account movement of
   ciphertext is detected by the client.
3. **Key separation:** authentication material cannot be used directly as a vault
   encryption or key-wrapping key.
4. **Password locality:** the master password is processed only in the client and
   is never transmitted or persisted.
5. **Compromise containment:** a stolen server database contains ciphertext and
   password-verification material, but no plaintext vault keys.
6. **Synchronization safety:** stale clients cannot silently overwrite newer
   objects.

## Protected assets

- Master password
- Master root key and all derived client keys
- Unwrapped vault key
- Vault item fields, folder names, favorites, and private settings
- Authentication sessions and refresh tokens
- Recovery material, if a recovery mechanism is added in a later protocol

## Trust boundaries

### Trusted while unlocked

- The browser origin executing the reviewed Amethyst client
- The user's browser and operating system
- The client cryptographic implementation and random-number generator

### Not trusted with plaintext

- Node.js API
- PostgreSQL
- Reverse proxy, logs, monitoring, and backups
- Object storage and synchronization infrastructure

### Operationally trusted

The server is trusted to enforce authorization and availability. It is not trusted
with vault confidentiality. A malicious server can delete data, withhold updates,
serve stale data, observe metadata, or deliver a malicious web client.

## Adversaries in scope

- Attacker who obtains a database snapshot or backup
- Passive network observer when TLS is correctly configured
- Honest-but-curious operator inspecting server-side data
- Attacker modifying stored ciphertext
- Cross-account API attacker
- Credential-stuffing and online password-guessing attacker
- Stale or concurrently editing legitimate client
- Attacker who steals a refresh-token database but not its plaintext cookie

## Adversaries outside the zero-knowledge guarantee

- Compromised browser, operating system, or malicious extension
- XSS or malicious dependency executing while the vault is unlocked
- Server compromise that alters the JavaScript delivered before unlock
- User disclosure through clipboard history, screenshots, autofill, or phishing
- Weak master passwords subjected to offline guessing
- Denial of service, deletion, rollback, or selective synchronization by the server
- Traffic analysis

These exclusions must be described to users. In particular, a web application
cannot cryptographically protect a password from JavaScript that the same origin
deliberately serves.

## Metadata visible to the server

- Email address and verification status
- Account and session timestamps
- Network and coarse client information
- Per-account object count, ciphertext sizes, and access/update timing
- Deletion activity and synchronization cursor values

The v1 opaque-object model encrypts object type, folder relationships, favorites,
labels, URLs, and item timestamps. Ciphertext padding is deferred.

## Mandatory invariants

1. The master password and master root key never cross the client boundary.
2. The vault key exists server-side only as authenticated ciphertext.
3. Every AES-GCM encryption uses a fresh 96-bit nonce under its key.
4. Authentication and encryption keys use distinct, versioned HKDF labels.
5. IDs and ownership are bound to ciphertext with authenticated additional data.
6. Authentication-tag failure never returns partial plaintext.
7. Unwrapped keys are never stored in Web Storage, IndexedDB, cookies, URLs, logs,
   telemetry, or crash reports.
8. All vault mutations require ownership checks and optimistic concurrency.
9. Password changes revoke existing sessions and atomically replace the key bundle.
10. Cryptographic formats are versioned and never inferred heuristically.

## Abuse cases and controls

| Abuse case                                 | Primary control                                            |
| ------------------------------------------ | ---------------------------------------------------------- |
| Database theft                             | Argon2id, separated keys, wrapped random vault key         |
| Ciphertext moved to another account/object | AES-GCM AAD binds owner and object IDs                     |
| Nonce reuse                                | CSPRNG generation and tests; never retry with an old nonce |
| Stale overwrite                            | Expected revision and HTTP 409 conflict                    |
| Session database theft                     | Hash refresh tokens; rotate and detect reuse               |
| Account enumeration                        | Synthetic pre-login data and generic responses             |
| Online guessing                            | Layered account/network rate limits and alerts             |
| XSS                                        | Strict CSP, Trusted Types, no third-party runtime scripts  |
| Sensitive logging                          | Body/cookie redaction and allowlisted structured logs      |
| Supply-chain compromise                    | Lockfiles, review, scanning, reproducible builds           |

## Residual risk

Argon2id raises the cost of offline guesses but cannot make a weak master password
safe. The server's authentication verifier gives a database attacker a way to test
password guesses after reproducing the client derivation. This is accepted for the
v1 verifier design and motivates evaluating OPAQUE before production use.
