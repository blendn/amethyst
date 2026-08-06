# Recovery policy

## Version 1 decision

Amethyst v1 has **no vault recovery mechanism**.

If a user loses the master password while every unlocked client is unavailable, the
encrypted vault is permanently unrecoverable. Support staff, database administrators,
and email-account access cannot decrypt it.

This is a security property, not merely a product limitation.

## Account reset

After proving control of the verified email address, a user may request account
reset. Reset means:

1. Revoke all sessions.
2. Schedule deletion of encrypted vault objects and the old key bundle.
3. Create a new empty cryptographic identity after an explicit destructive warning.
4. Preserve only the minimum operational audit record required by policy.

Reset must never relabel old ciphertext under a new key bundle or imply that old
data can be recovered later. A cooling-off period may be used for deletion safety,
but it does not make ciphertext decryptable.

## Master-password change

A normal change requires the current password and a successfully unwrapped vault
key. It rewraps the existing vault key and revokes all sessions. It is not a recovery
operation.

## Future recovery options

Any recovery feature changes the trust model and requires a new design review.
Possible explicit mechanisms include:

- A high-entropy printable recovery key that independently wraps the vault key
- A user-controlled offline recovery file
- Threshold recovery split among user-selected parties

Amethyst will not implement security questions, emailed decryption keys, operator
escrow, or a hidden master key.

If recovery is introduced, it must be opt-in, clearly disclose who can decrypt,
support revocation/rotation, and use a separately versioned key envelope.
