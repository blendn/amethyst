import { Router } from "express";
import {
  createVaultObjectSchema,
  deleteVaultObjectSchema,
  updateVaultObjectSchema,
} from "@amethyst/protocol";
import { pool } from "./database.js";
import { requireAuth } from "./auth.js";
import { HttpError } from "./http.js";

export const vaultRouter = Router();
vaultRouter.use(requireAuth);

type StoredObject = {
  id: string;
  format_version: number;
  nonce: string;
  ciphertext: string;
  revision: string;
  deleted_at: Date | null;
};

function envelope(row: StoredObject) {
  return {
    id: row.id,
    version: row.format_version,
    nonce: row.nonce,
    ciphertext: row.ciphertext,
    revision: Number(row.revision),
    deletedAt: row.deleted_at?.toISOString() ?? null,
  };
}

vaultRouter.get("/objects", async (request, response) => {
  const result = await pool.query<StoredObject>(
    `SELECT id, format_version, nonce, ciphertext, revision, deleted_at
       FROM vault_objects
      WHERE user_id = $1
      ORDER BY revision ASC`,
    [request.auth!.userId],
  );
  response.json({ objects: result.rows.map(envelope) });
});

vaultRouter.post("/objects", async (request, response) => {
  const body = createVaultObjectSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const revisionResult = await client.query<{ current_revision: string }>(
      `UPDATE user_revisions SET current_revision = current_revision + 1
        WHERE user_id = $1 RETURNING current_revision`,
      [request.auth!.userId],
    );
    const revision = revisionResult.rows[0]?.current_revision;
    if (!revision) throw new HttpError(404, "account_not_found", "Account not found.");
    const insert = await client.query<StoredObject>(
      `INSERT INTO vault_objects
        (id, user_id, format_version, nonce, ciphertext, revision)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, format_version, nonce, ciphertext, revision, deleted_at`,
      [body.id, request.auth!.userId, body.version, body.nonce, body.ciphertext, revision],
    );
    await client.query("COMMIT");
    response.status(201).json(envelope(insert.rows[0]!));
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") {
      throw new HttpError(409, "object_exists", "Vault object already exists.");
    }
    throw error;
  } finally {
    client.release();
  }
});

vaultRouter.put("/objects/:id", async (request, response) => {
  const body = updateVaultObjectSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ revision: string }>(
      "SELECT revision FROM vault_objects WHERE user_id = $1 AND id = $2 FOR UPDATE",
      [request.auth!.userId, request.params.id],
    );
    const row = current.rows[0];
    if (!row) throw new HttpError(404, "object_not_found", "Vault object not found.");
    if (Number(row.revision) !== body.expectedRevision) {
      throw new HttpError(409, "revision_conflict", "The vault object changed on another client.");
    }
    const revisionResult = await client.query<{ current_revision: string }>(
      `UPDATE user_revisions SET current_revision = current_revision + 1
        WHERE user_id = $1 RETURNING current_revision`,
      [request.auth!.userId],
    );
    const revision = revisionResult.rows[0]!.current_revision;
    const update = await client.query<StoredObject>(
      `UPDATE vault_objects
          SET format_version = $3, nonce = $4, ciphertext = $5,
              revision = $6, deleted_at = NULL, updated_at = NOW()
        WHERE user_id = $1 AND id = $2
      RETURNING id, format_version, nonce, ciphertext, revision, deleted_at`,
      [request.auth!.userId, request.params.id, body.version, body.nonce, body.ciphertext, revision],
    );
    await client.query("COMMIT");
    response.json(envelope(update.rows[0]!));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

vaultRouter.delete("/objects/:id", async (request, response) => {
  const body = deleteVaultObjectSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ revision: string }>(
      "SELECT revision FROM vault_objects WHERE user_id = $1 AND id = $2 FOR UPDATE",
      [request.auth!.userId, request.params.id],
    );
    const row = current.rows[0];
    if (!row) throw new HttpError(404, "object_not_found", "Vault object not found.");
    if (Number(row.revision) !== body.expectedRevision) {
      throw new HttpError(409, "revision_conflict", "The vault object changed on another client.");
    }
    const revisionResult = await client.query<{ current_revision: string }>(
      `UPDATE user_revisions SET current_revision = current_revision + 1
        WHERE user_id = $1 RETURNING current_revision`,
      [request.auth!.userId],
    );
    const revision = revisionResult.rows[0]!.current_revision;
    await client.query(
      `UPDATE vault_objects SET revision = $3, deleted_at = NOW(), updated_at = NOW()
        WHERE user_id = $1 AND id = $2`,
      [request.auth!.userId, request.params.id, revision],
    );
    await client.query("COMMIT");
    response.status(204).send();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

