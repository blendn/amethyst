CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email_normalized TEXT NOT NULL UNIQUE,
  auth_verifier BYTEA NOT NULL,
  kdf_salt TEXT NOT NULL,
  kdf_params JSONB NOT NULL,
  wrapped_vault_key JSONB NOT NULL,
  security_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS registration_reservations (
  id UUID PRIMARY KEY,
  email_normalized TEXT NOT NULL,
  token_hash BYTEA NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash BYTEA NOT NULL UNIQUE,
  security_version INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_revisions (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_revision BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vault_objects (
  id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  format_version INTEGER NOT NULL,
  nonce TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  revision BIGINT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS vault_objects_sync_idx
  ON vault_objects(user_id, revision);

CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS registrations_expiry_idx
  ON registration_reservations(expires_at);

