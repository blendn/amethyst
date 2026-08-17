import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  loginRequestSchema,
  preloginRequestSchema,
  registerRequestSchema,
} from "@amethyst/protocol";
import { config } from "./config.js";
import { pool } from "./database.js";
import { HttpError } from "./http.js";
import {
  authVerifier,
  normalizeEmail,
  randomToken,
  secureEqual,
  tokenHash,
} from "./security.js";

const SESSION_COOKIE =
  config.NODE_ENV === "production"
    ? "__Host-amethyst_session"
    : "amethyst_session";
const DEMO_KDF_PARAMS = {
  memoryKiB: 65_536,
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
} as const;

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; securityVersion: number; sessionId: string };
    }
  }
}

function setSessionCookie(response: Response, token: string): void {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: config.SESSION_TTL_HOURS * 60 * 60 * 1000,
  });
}

function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
}

export async function requireAuth(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawToken = request.cookies[SESSION_COOKIE] as string | undefined;
    if (!rawToken)
      throw new HttpError(401, "unauthorized", "Authentication required.");

    const result = await pool.query<{
      id: string;
      user_id: string;
      security_version: number;
      current_security_version: number;
    }>(
      `SELECT s.id, s.user_id, s.security_version,
              u.security_version AS current_security_version
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [tokenHash(rawToken)],
    );

    const session = result.rows[0];
    if (
      !session ||
      session.security_version !== session.current_security_version
    ) {
      throw new HttpError(401, "unauthorized", "Authentication required.");
    }

    request.auth = {
      userId: session.user_id,
      securityVersion: session.security_version,
      sessionId: session.id,
    };
    await pool.query("UPDATE sessions SET last_used_at = NOW() WHERE id = $1", [
      session.id,
    ]);
    next();
  } catch (error) {
    next(error);
  }
}

export const authRouter = Router();

authRouter.post("/prelogin", async (request, response) => {
  const { email } = preloginRequestSchema.parse(request.body);
  const normalized = normalizeEmail(email);
  const existing = await pool.query<{
    id: string;
    kdf_salt: string;
    kdf_params: typeof DEMO_KDF_PARAMS;
  }>("SELECT id, kdf_salt, kdf_params FROM users WHERE email_normalized = $1", [
    normalized,
  ]);

  const user = existing.rows[0];
  if (user) {
    response.json({
      userId: user.id,
      kdfSalt: user.kdf_salt,
      kdfParams: user.kdf_params,
      authSchemeVersion: 1,
      registration: false,
    });
    return;
  }

  const userId = randomUUID();
  const registrationToken = randomToken();
  const kdfSalt = randomToken(16);
  await pool.query(
    `INSERT INTO registration_reservations
       (id, email_normalized, token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')`,
    [userId, normalized, tokenHash(registrationToken)],
  );

  response.json({
    userId,
    kdfSalt,
    kdfParams: DEMO_KDF_PARAMS,
    authSchemeVersion: 1,
    registration: true,
    registrationToken,
  });
});

authRouter.post("/register", async (request, response) => {
  const body = registerRequestSchema.parse(request.body);
  const normalized = normalizeEmail(body.email);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const reservationResult = await client.query<{
      id: string;
      email_normalized: string;
    }>(
      `DELETE FROM registration_reservations
        WHERE token_hash = $1 AND expires_at > NOW()
      RETURNING id, email_normalized`,
      [tokenHash(body.registrationToken)],
    );
    const reservation = reservationResult.rows[0];
    if (!reservation || reservation.email_normalized !== normalized) {
      throw new HttpError(
        400,
        "invalid_registration",
        "Registration could not be completed.",
      );
    }

    await client.query(
      `INSERT INTO users
        (id, email_normalized, auth_verifier, kdf_salt, kdf_params, wrapped_vault_key)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        reservation.id,
        normalized,
        authVerifier(body.loginSecret),
        body.kdfSalt,
        JSON.stringify(body.kdfParams),
        JSON.stringify(body.keyBundle),
      ],
    );
    await client.query("INSERT INTO user_revisions (user_id) VALUES ($1)", [
      reservation.id,
    ]);
    await client.query("COMMIT");
    response.status(201).json({ userId: reservation.id });
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") {
      throw new HttpError(409, "account_exists", "An account already exists.");
    }
    throw error;
  } finally {
    client.release();
  }
});

authRouter.post("/login", async (request, response) => {
  const body = loginRequestSchema.parse(request.body);
  const normalized = normalizeEmail(body.email);
  const result = await pool.query<{
    id: string;
    auth_verifier: Buffer;
    security_version: number;
    kdf_salt: string;
    kdf_params: typeof DEMO_KDF_PARAMS;
    wrapped_vault_key: { version: 1; nonce: string; ciphertext: string };
  }>(
    `SELECT id, auth_verifier, security_version, kdf_salt, kdf_params, wrapped_vault_key
       FROM users WHERE email_normalized = $1`,
    [normalized],
  );

  const user = result.rows[0];
  const candidate = authVerifier(body.loginSecret);
  if (!user || !secureEqual(candidate, user.auth_verifier)) {
    throw new HttpError(
      401,
      "invalid_credentials",
      "Invalid email or master password.",
    );
  }

  const sessionId = randomUUID();
  const sessionToken = randomToken();
  await pool.query(
    `INSERT INTO sessions
      (id, user_id, token_hash, security_version, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + ($5 * INTERVAL '1 hour'))`,
    [
      sessionId,
      user.id,
      tokenHash(sessionToken),
      user.security_version,
      config.SESSION_TTL_HOURS,
    ],
  );
  setSessionCookie(response, sessionToken);
  response.json({
    userId: user.id,
    email: normalized,
    kdfSalt: user.kdf_salt,
    kdfParams: user.kdf_params,
    keyBundle: user.wrapped_vault_key,
  });
});

authRouter.get("/session", requireAuth, async (request, response) => {
  const result = await pool.query<{
    email_normalized: string;
    kdf_salt: string;
    kdf_params: typeof DEMO_KDF_PARAMS;
    wrapped_vault_key: { version: 1; nonce: string; ciphertext: string };
  }>(
    "SELECT email_normalized, kdf_salt, kdf_params, wrapped_vault_key FROM users WHERE id = $1",
    [request.auth!.userId],
  );
  const user = result.rows[0];
  if (!user)
    throw new HttpError(401, "unauthorized", "Authentication required.");
  response.json({
    userId: request.auth!.userId,
    email: user.email_normalized,
    kdfSalt: user.kdf_salt,
    kdfParams: user.kdf_params,
    keyBundle: user.wrapped_vault_key,
  });
});

authRouter.post("/logout", requireAuth, async (request, response) => {
  await pool.query("DELETE FROM sessions WHERE id = $1", [
    request.auth!.sessionId,
  ]);
  clearSessionCookie(response);
  response.status(204).send();
});
