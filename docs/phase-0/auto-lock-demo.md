# Demo auto-lock behavior

Status: **educational-app lifecycle feature, not an approved security control**.
This behavior uses the existing demo lock and unlock path. It does not change
persisted account, key-bundle, or vault-object bytes or version identifiers, so
there is no stored-data migration. The five-minute timeout is a provisional user
experience choice, not a reviewed production policy.

While the vault is unlocked, pointer presses, keyboard input, and touch starts
restart the five-minute inactivity clock. An interaction after the deadline locks
the vault before that interaction can act on the old unlocked view. When a hidden
tab becomes visible or regains focus, the client checks elapsed wall-clock time;
it does not rely on background timers firing on schedule. Leaving the page also
requests a lock, including when the browser may preserve the page in its back
cache. A clock rollback locks rather than extending the deadline.

Automatic and manual locking use the same reducer action: they drop React
references to the vault key, decrypted entries, and folders. The unlocked screen,
including entry editors and revealed passwords, unmounts. A local lifecycle
counter prevents callbacks from an operation started before locking from updating
a newly unlocked vault. An in-flight server mutation may still complete; the
next unlock reloads the vault from the server. Unlock requires the master password
again. Locking keeps the cookie session; signing out clears local state first and
then asks the server to end that session.

The browser cannot guarantee immediate erasure of old JavaScript strings or
`CryptoKey` objects. This feature does not implement secure memory, worker cleanup,
or the reviewed protocol's full [locking and memory lifecycle](cryptographic-protocol.md#locking-and-memory-lifecycle).
