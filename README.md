# Amethyst

Amethyst is an open-source, zero-knowledge password manager built for learning.

> **Educational prototype — do not store real credentials.** The demo has not
> received an independent security audit.

The repository contains a demo vertical slice alongside the draft Phase 0 design.
Temporary demo choices are not an approval of the protocol for production use.

## Demo features

- Register and sign in with a master password that remains in the browser
- Argon2id key derivation with separated authentication and encryption branches
- Random vault key wrapped with AES-256-GCM
- Lock and unlock without storing the unwrapped key
- Create, read, update, and delete encrypted login entries
- Encrypted folders with entry assignment and folder filtering
- Favorites with quick toggling and a dedicated filtered view
- Local search and cryptographically secure password generation
- Cookie sessions, PostgreSQL persistence, and optimistic revisions

## Run locally

Requirements: Node.js 22+, npm, PostgreSQL 17, and optionally Docker Compose.

### Docker Compose

```bash
docker compose up --build
```

Open <http://localhost:5173>.

### Without Compose

Create a PostgreSQL database, then:

```bash
cp .env.example .env
npm install
set -a
source .env
set +a
npm run dev
```

The API applies the demo migration on startup. Open <http://localhost:5173>.

## Verify

```bash
npm run typecheck
npm test
npm run build
```

For the presentation, create a disposable account and entry, then inspect
`vault_objects.ciphertext` in PostgreSQL. Names, usernames, passwords, URLs, notes,
folder data, and favorite state are contained only in client-encrypted ciphertext.

## Design documents

- [`docs/phase-0/threat-model.md`](docs/phase-0/threat-model.md)
- [`docs/phase-0/cryptographic-protocol.md`](docs/phase-0/cryptographic-protocol.md)
- [`docs/phase-0/authentication.md`](docs/phase-0/authentication.md)
- [`docs/phase-0/recovery-policy.md`](docs/phase-0/recovery-policy.md)
- [`docs/phase-0/protocol-versioning.md`](docs/phase-0/protocol-versioning.md)
- [`docs/phase-0/test-vector-plan.md`](docs/phase-0/test-vector-plan.md)

These documents describe the intended protocol, not a claim that the system has
been audited or is ready to protect real credentials.
