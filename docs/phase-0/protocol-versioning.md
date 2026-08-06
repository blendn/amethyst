# Protocol versioning and migration

## Version dimensions

Do not use one ambiguous global version. Track these independently:

- API version
- Authentication scheme version
- KDF suite and parameter set
- Key-bundle format version
- Vault-object envelope version
- Decrypted object schema version
- Synchronization protocol version

## Rules

1. Every persistent cryptographic structure carries an explicit version.
2. A version selects one exact byte encoding and primitive suite.
3. Clients reject unknown major/critical versions before decryption.
4. Parsers must not guess versions from field presence or ciphertext length.
5. Existing ciphertext is never rewritten in place without a committed migration.
6. Migration is decrypt-old, validate, encrypt-new, verify-new, then commit.
7. The old copy remains until the new copy is durably synchronized.
8. Downgrades that weaken KDF or cryptographic parameters are prohibited.

## KDF parameter upgrades

KDF parameters are per account. After a successful unlock, the client may recommend
an upgrade. Upgrading performs the master-password-change wrapping procedure with a
new salt and parameters, even if the password itself is unchanged. It also updates
the authentication verifier atomically.

Clients enforce protocol minimums and safe allocation maximums. A server cannot
silently force weak or resource-exhausting values.

## Object schema migration

Object envelope version describes cryptography and outer encoding. Object schema
version describes decrypted fields. A schema-only change may reuse the current
envelope construction but always uses a fresh nonce when re-encrypted.

Clients retain unknown non-critical fields during a read-modify-write cycle. Unknown
critical fields cause a read-only compatibility error.

## API compatibility

The API uses `/api/v1`. Additive response fields are allowed; clients ignore unknown
non-critical fields. Removing or changing field meaning requires a new API version.

Error codes are stable machine identifiers. Cryptographic errors remain deliberately
coarse and never reveal whether password derivation, key unwrap, tag validation, or
decoding was closest to success.

## Rollout

For any cryptographic migration:

1. Ship readers for old and new versions.
2. Observe compatibility without writing the new format.
3. Enable new writes behind a controlled rollout.
4. Migrate only from an unlocked client.
5. Verify cross-client synchronization and recovery from interruption.
6. Retire old writes before eventually retiring old reads.

Server-side migrations cannot decrypt and upgrade vault objects.
