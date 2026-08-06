# Authentication and sessions

Status: **draft; verifier approach requires explicit approval**.

## Separation from vault encryption

Authentication authorizes access to ciphertext. Unlocking decrypts ciphertext.
Successful authentication must not imply that the client possesses a vault key,
and the API must never request proof by decrypting a vault item.

## Version 1 derived-secret verifier

The cryptographic protocol derives a 32-byte `loginSecret` through an HKDF branch
that is independent from the key-encryption key.

### Registration

1. Client obtains/reserves a user ID.
2. Client derives `loginSecret` and produces the wrapped vault key.
3. Over TLS, client sends email, KDF configuration, `loginSecret`, and key bundle.
4. Server computes a password-storage verifier over the full binary login secret,
   with a unique server-side salt and approved library encoding.
5. An optional pepper is held outside PostgreSQL.
6. Server persists only the verifier and immediately releases `loginSecret`.

Request bodies containing authentication material must be excluded from logging,
tracing, error capture, queues, and replay tooling.

### Pre-login

`POST /api/v1/auth/prelogin` accepts an email and returns the account's KDF suite.
For an unknown email, it returns deterministic synthetic parameters derived with a
server secret so that responses have the same shape and stable behavior. Rate limits
apply regardless of account existence.

### Login

1. Client fetches KDF parameters.
2. Client derives `loginSecret` locally.
3. Client sends it over TLS to the login endpoint.
4. Server verifies in constant time and returns only a generic failure otherwise.
5. Server creates a random session and refresh token.
6. Refresh token is delivered as a `__Host-` cookie with `Secure`, `HttpOnly`,
   `SameSite=Strict`, and `Path=/`.
7. Server stores only a keyed hash or cryptographic hash of the refresh token.
8. Client receives the encrypted key bundle and may attempt local unlock.

The login secret is password-equivalent for authentication. It must never be stored
by the client or server in recoverable form.

## Session model

- Access lifetime: short, initially 10 minutes.
- Refresh lifetime: initially 30 days absolute, with a shorter inactivity window.
- Refresh tokens rotate on every use.
- Reuse of a previously rotated token revokes the token family.
- Password change and logout-all increment `securityVersion`.
- Sensitive account operations require recent reauthentication.
- Session identifiers are generated from at least 256 bits of CSPRNG output.

The exact access mechanism—opaque cookie session versus in-memory bearer token—must
be decided with the deployment origin model. No token may be stored in Web Storage.

## CSRF and browser controls

If cookies authenticate API mutations:

- Verify same-origin `Origin`/`Sec-Fetch-Site` headers.
- Use an anti-CSRF token for state-changing requests.
- Restrict CORS to the actual web origin.
- Reject simple content types where JSON is required.

Cookie flags are defense in depth, not the sole CSRF control.

## Rate limiting

Use layered limits with generic errors:

- Per normalized account identifier
- Per IP/network signal
- Per session for refresh and sensitive operations
- Global emergency controls

Do not permanently lock accounts in a way that permits denial of service. Backoff,
temporary limits, security notifications, and optional challenges are preferred.

## Email verification and reset

Email verification tokens are random, single-use, short-lived, and stored hashed.
Email ownership does not grant vault decryption capability.

An email-based password reset can delete/reset an account or create a new empty
vault, but it cannot recover the existing vault under the v1 recovery policy.

## Future OPAQUE migration

Before production use, evaluate an audited OPAQUE implementation with browser and
Node interoperability. Migration must be a new authentication scheme version and
must not improvise protocol messages. Existing users can enroll after authenticating
and unlocking; the old verifier remains until enrollment commits atomically.
