# Phase 0 decision record

Status: **design decisions recorded; Phase 0 and the protocol remain unapproved**.
Recorded: 2026-09-23. These decisions govern subsequent design work. They do not
retroactively validate the existing demo or authorize storing real credentials.

## Decisions and gates

| Topic                      | Decision                                                                                                                                                                                                                                                                                               | Status and next gate                                                                                                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser/device floor       | Require a secure context, browser CSPRNG, WebCrypto AES-GCM and HKDF, and WebAssembly. Target current and previous major Chromium, Firefox, and Safari releases on desktop, Chrome on Android, and Safari on iOS. Reject unsupported clients before registration or unlock.                            | **Capability policy decided; support floor pending measurement.** Minimum mobile RAM and exact browser/OS versions require Argon2id benchmarks and compatibility tests. No mobile support claim yet.                                                                        |
| Argon2id                   | Keep Argon2id v1.3 with a per-account salt and parameter record. Select memory, passes, and parallelism from the [benchmark plan](argon2id-benchmark-plan.md), then review minimum and maximum accepted values.                                                                                        | **Selection process decided; numbers pending benchmarks and external review.** The demo's 65,536 KiB, 3 passes, and parallelism 1 are provisional.                                                                                                                          |
| Authentication             | The derived `loginSecret` verifier is permitted only for the educational demo. Keep authentication and vault-encryption keys separate. Evaluate an independently reviewed OPAQUE implementation and migration before any production design approval.                                                   | **Demo choice decided; production scheme pending external review.** OPAQUE is not specified or implemented here.                                                                                                                                                            |
| Serialization              | Choose deterministic CBOR for the intended reviewed protocol. Encode UUIDs as 16 raw bytes and define a strict CBOR profile, field schema, and exact AAD layout before vectors.                                                                                                                        | **Format family decided; byte profile pending review/vectors.** The demo uses ordinary JSON and textual UUIDs. Its stored `version: 1` bytes must remain readable under their current interpretation; new CBOR structures need new format identifiers and a migration plan. |
| Tombstones and full resync | Retain tombstones for **at least 90 days**. A client with a cursor older than retained history must replace its local object set from an authoritative full snapshot before uploading pending changes; absence from that snapshot means deletion.                                                      | **Policy decided; sync protocol and operational review pending.** The demo only returns a full list and currently retains tombstones indefinitely. Purging must wait for a cursor-expiry/full-snapshot protocol and tests.                                                  |
| Email normalization        | For a new account identity scheme, accept ASCII email addresses, trim surrounding ASCII whitespace, lowercase ASCII letters in both local and domain parts for lookup, and preserve dots, plus tags, and all other internal characters. Do not apply provider-specific rules or Unicode normalization. | **Policy decided; compatibility review pending.** The demo uses JavaScript `trim()` and locale lowercase; changing existing account lookup requires a collision audit and account migration, not a silent switch.                                                           |
| Encrypted local caching    | Default to **off**. Keep vault plaintext and unwrapped keys in memory only. If an opt-in encrypted offline cache is proposed later, specify key handling, invalidation on lock/logout/account switch, stale-sync behavior, and browser-storage threat assumptions first.                               | **Default decided; optional cache requires separate design/review.** The demo has no vault cache; theme preference in localStorage is unrelated.                                                                                                                            |

For the email rule above, surrounding ASCII whitespace means U+0020 space and
U+0009 tab. For full resync, pending local edits must be quarantined for explicit
conflict resolution; a deleted object must never be silently resurrected.

## Audit against the running demo

The draft documents describe intended controls, while the repository currently
ships the following provisional behavior:

| Area                            | Current implementation                                                                                                                                                        | Documented target or gap                                                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistent crypto bytes         | `key-bundle.ts` and `vault-objects.ts` use `JSON.stringify` for AAD; object plaintext is ordinary JSON. IDs and salt are textual in AAD.                                      | Draft protocol calls for deterministic encoding and raw UUID bytes. A new format version, explicit readers, migration, and independent vectors are required before changing bytes. |
| KDF                             | `hash-wasm` Argon2id uses the demo server's 64 MiB/3/1 parameter set. Protocol schemas accept a wider range.                                                                  | Select measured minimum, default, and safe allocation maximum; validate hostile pre-login values before expensive work.                                                            |
| Verifier and pre-login          | Server stores HMAC-SHA-256 of the base64url login secret under a configured pepper. Unknown emails receive a fresh registration reservation, not stable synthetic parameters. | Authentication draft describes a per-user password-storage verifier and deterministic synthetic pre-login response. Both need redesign and review.                                 |
| Sessions and browser controls   | One hashed cookie session token with configurable absolute TTL; logout deletes that session. Mutation origin check rejects a wrong `Origin` when supplied.                    | Draft calls for refresh rotation/reuse detection, stronger CSRF checks, recent reauthentication, and layered rate limits. These are not implemented.                               |
| Sync/deletion                   | API lists all objects including tombstones; browser ignores deleted records and reloads the full list. No incremental cursor or purge exists.                                 | Implement cursor expiry, authoritative full resync, and retention before tombstone cleanup or offline cache.                                                                       |
| Object validation and lifecycle | Browser checks schema version, type, and object ID after decrypting, and drops React state on lock.                                                                           | Draft requires strict canonical decoding, bounds/version checks, and fuller memory/worker cleanup. Browser memory erasure cannot be guaranteed.                                    |
| Recovery and password change    | No vault recovery or master-password-change flow is implemented.                                                                                                              | Recovery policy remains a design decision; password-change procedure requires implementation and review.                                                                           |

The API route prefix `/api/v1` and the demo's `authSchemeVersion: 1`, key-bundle
`version: 1`, and object `version: 1` are existing identifiers. They do not
establish that the draft protocol's byte format was ever shipped. A future
implementation must explicitly distinguish demo readers from new readers, allocate
new cryptographic format versions, and test interrupted migration. An API path
version alone is insufficient.

## Required follow-up before implementation approval

1. Run the benchmark plan and record raw results, device floor, chosen parameters,
   and safe client bounds.
2. Review the authentication scheme, including the offline-guessing consequences
   of the demo verifier and the feasibility of OPAQUE.
3. Specify exact deterministic CBOR bytes and version identifiers, then generate
   vectors and verify them with an independent implementation.
4. Design migration of existing demo accounts and ciphertext, including collisions
   under the proposed email rule and mixed-version sync.
5. Review the sync protocol and deployment security controls against the threat
   model before changing retention or claiming production suitability.
