# Cryptographic test-vector plan

## Purpose

Version 1 test vectors are the executable interpretation of the protocol. They must
be generated only after byte encodings and open wire-format decisions are frozen.

Vectors must be verified by two independent implementations, ideally using different
languages and cryptographic libraries. Matching encrypt/decrypt code from one
implementation is insufficient because both paths may share the same mistake.

## Proposed fixture layout

```text
packages/test-vectors/
  v1/
    manifest.json
    argon2id.json
    key-derivation.json
    key-wrapping.json
    vault-objects.json
    invalid-cases.json
  README.md
```

Fixtures use lowercase hexadecimal for raw bytes. Display strings are supplementary
and never treated as cryptographic inputs.

## Required positive vectors

### Password encoding and Argon2id

- ASCII master password
- Empty password at the primitive layer, even if product policy rejects it
- Leading and trailing spaces
- Composed and decomposed Unicode that must produce different byte sequences
- Non-BMP characters
- Embedded NUL byte in UTF-8 input
- Minimum and maximum product-supported password lengths

Each vector records password UTF-8 bytes, salt, all Argon2 parameters, and output.

### HKDF separation

- PRK
- Key-encryption key
- Login secret
- Evidence that changing either label changes its output

### Key wrapping

- Fixed user ID, KDF configuration, vault key, nonce, serialized AAD, ciphertext,
  and tag
- Same vault key with a different nonce
- Same inputs with a different user ID

### Vault objects

- Login with every field populated
- Login with empty optional fields
- Folder object
- Settings object
- Unicode and large notes
- Deterministic plaintext encoding bytes
- AAD, nonce, ciphertext, and tag

## Required negative vectors

- Wrong master password
- Modified KDF salt or parameter
- Wrong user ID or object ID in AAD
- Modified nonce, ciphertext, or authentication tag
- Truncated and oversized fields
- Unsupported envelope and object versions
- Duplicate map keys and non-canonical encoding
- Mismatch between outer and encrypted object ID
- Invalid UTF-8 where text is required
- Unknown critical field

Every negative vector defines the expected coarse error category and confirms that
no plaintext is returned.

## Property and integration tests

- Repeated encryption of the same plaintext produces different nonces/ciphertext.
- Generated nonces have the required length and no observed duplicates in stress
  tests; this supplements rather than proves RNG safety.
- Object decrypts only for the correct account and object ID.
- Lock removes access to all decrypted objects and search indexes.
- Password change preserves the vault key and object decryptability.
- Stale revisions are rejected without overwriting newer ciphertext.
- Browser and reference implementation consume the exact same fixtures.

## Approval record

The completed vector manifest should record:

- Protocol document commit identifier
- Generator implementation and dependency versions
- Independent verifier implementation and dependency versions
- Reviewer names or handles
- Date and approval status

Changing any normative byte-level rule requires new vectors and a new applicable
format version.
