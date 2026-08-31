import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const webOrigin = "http://localhost:5173";

type ApiResponse = {
  status: number;
  body: unknown;
  cookie: string | undefined;
};

let server: Server | undefined;
let pool: Pool | undefined;
let baseUrl: string;

async function request(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string;
    origin?: string;
  } = {},
): Promise<ApiResponse> {
  const headers = new Headers();
  if (options.body !== undefined)
    headers.set("content-type", "application/json");
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.origin) headers.set("origin", options.origin);

  const init: RequestInit = { headers };
  if (options.method) init.method = options.method;
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  const response = await fetch(`${baseUrl}${path}`, init);
  const setCookie = response.headers.get("set-cookie");
  const body =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined);
  return {
    status: response.status,
    body,
    cookie: setCookie?.split(";", 1)[0],
  };
}

async function registerAndLogin(email: string) {
  const prelogin = await request("/api/v1/auth/prelogin", {
    method: "POST",
    origin: webOrigin,
    body: { email },
  });
  expect(prelogin.status).toBe(200);
  const registration = prelogin.body as {
    registrationToken: string;
    kdfSalt: string;
    kdfParams: {
      memoryKiB: number;
      iterations: number;
      parallelism: number;
      hashLength: 32;
    };
  };
  const loginSecret = `integration-secret-${randomUUID()}`;
  const registered = await request("/api/v1/auth/register", {
    method: "POST",
    origin: webOrigin,
    body: {
      registrationToken: registration.registrationToken,
      email,
      loginSecret,
      kdfSalt: registration.kdfSalt,
      kdfParams: registration.kdfParams,
      keyBundle: {
        version: 1,
        nonce: "AAAAAAAAAAAAAAAA",
        ciphertext: "integration-test-key-bundle",
      },
    },
  });
  expect(registered.status).toBe(201);

  const login = await request("/api/v1/auth/login", {
    method: "POST",
    origin: webOrigin,
    body: { email, loginSecret },
  });
  expect(login.status).toBe(200);
  expect(login.cookie).toBeDefined();
  return { cookie: login.cookie!, loginSecret };
}

describe.skipIf(!testDatabaseUrl)("API integration", () => {
  beforeAll(async () => {
    const databaseUrl = new URL(testDatabaseUrl!);
    const databaseName = databaseUrl.pathname.slice(1);
    if (!databaseName.endsWith("_test")) {
      throw new Error(
        `Refusing to run integration tests against non-test database “${databaseName}”.`,
      );
    }

    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.WEB_ORIGIN = webOrigin;
    process.env.AUTH_PEPPER = "integration-test-pepper-at-least-32-bytes";
    process.env.SESSION_TTL_HOURS = "1";

    const database = await import("./database.js");
    pool = database.pool;
    await database.migrate();
    const { createApp } = await import("./app.js");

    const listeningServer = createApp().listen(0, "127.0.0.1");
    server = listeningServer;
    await new Promise<void>((resolve, reject) => {
      listeningServer.once("listening", resolve);
      listeningServer.once("error", reject);
    });
    const address = listeningServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    if (!pool) throw new Error("Test database pool was not initialized.");
    await pool.query(
      "TRUNCATE registration_reservations, sessions, vault_objects, user_revisions, users CASCADE",
    );
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      );
    }
    if (pool) await pool.end();
  });

  it("registers, restores, and revokes an authenticated session", async () => {
    const email = "session@example.com";
    const { cookie, loginSecret } = await registerAndLogin(email);

    const session = await request("/api/v1/auth/session", { cookie });
    expect(session.status).toBe(200);
    expect(session.body).toMatchObject({ email });

    const wrongPassword = await request("/api/v1/auth/login", {
      method: "POST",
      origin: webOrigin,
      body: { email, loginSecret: `${loginSecret}-wrong` },
    });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body).toMatchObject({ error: "invalid_credentials" });

    const logout = await request("/api/v1/auth/logout", {
      method: "POST",
      origin: webOrigin,
      cookie,
      body: {},
    });
    expect(logout.status).toBe(204);
    expect((await request("/api/v1/auth/session", { cookie })).status).toBe(
      401,
    );
  });

  it("persists encrypted objects, rejects stale writes, and emits tombstones", async () => {
    const { cookie } = await registerAndLogin("vault@example.com");
    const id = randomUUID();
    const created = await request("/api/v1/vault/objects", {
      method: "POST",
      origin: webOrigin,
      cookie,
      body: {
        id,
        version: 1,
        nonce: "AAAAAAAAAAAAAAAA",
        ciphertext: "opaque-ciphertext-v1",
      },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ id, revision: 1, deletedAt: null });

    const updated = await request(`/api/v1/vault/objects/${id}`, {
      method: "PUT",
      origin: webOrigin,
      cookie,
      body: {
        version: 1,
        nonce: "BBBBBBBBBBBBBBBB",
        ciphertext: "opaque-ciphertext-v2",
        expectedRevision: 1,
      },
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ id, revision: 2 });

    const stale = await request(`/api/v1/vault/objects/${id}`, {
      method: "PUT",
      origin: webOrigin,
      cookie,
      body: {
        version: 1,
        nonce: "CCCCCCCCCCCCCCCC",
        ciphertext: "stale-ciphertext",
        expectedRevision: 1,
      },
    });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ error: "revision_conflict" });

    const removed = await request(`/api/v1/vault/objects/${id}`, {
      method: "DELETE",
      origin: webOrigin,
      cookie,
      body: { expectedRevision: 2 },
    });
    expect(removed.status).toBe(204);

    const listed = await request("/api/v1/vault/objects", { cookie });
    expect(listed.status).toBe(200);
    const objects = (listed.body as { objects: Array<Record<string, unknown>> })
      .objects;
    expect(objects).toHaveLength(1);
    expect(objects[0]).toMatchObject({ id, revision: 3 });
    expect(objects[0]?.deletedAt).toEqual(expect.any(String));
  });

  it("isolates vault objects by account ownership", async () => {
    const owner = await registerAndLogin("owner@example.com");
    const outsider = await registerAndLogin("outsider@example.com");
    const id = randomUUID();

    expect(
      (
        await request("/api/v1/vault/objects", {
          method: "POST",
          origin: webOrigin,
          cookie: owner.cookie,
          body: {
            id,
            version: 1,
            nonce: "AAAAAAAAAAAAAAAA",
            ciphertext: "owner-ciphertext",
          },
        })
      ).status,
    ).toBe(201);

    const outsiderList = await request("/api/v1/vault/objects", {
      cookie: outsider.cookie,
    });
    expect(outsiderList.body).toEqual({ objects: [] });

    const outsiderUpdate = await request(`/api/v1/vault/objects/${id}`, {
      method: "PUT",
      origin: webOrigin,
      cookie: outsider.cookie,
      body: {
        version: 1,
        nonce: "BBBBBBBBBBBBBBBB",
        ciphertext: "outsider-ciphertext",
        expectedRevision: 1,
      },
    });
    expect(outsiderUpdate.status).toBe(404);

    const ownerList = await request("/api/v1/vault/objects", {
      cookie: owner.cookie,
    });
    expect(ownerList.body).toMatchObject({
      objects: [{ id, ciphertext: "owner-ciphertext" }],
    });
  });

  it("rejects a state-changing request from another origin", async () => {
    const response = await request("/api/v1/auth/prelogin", {
      method: "POST",
      origin: "https://attacker.example",
      body: { email: "origin@example.com" },
    });
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "invalid_origin",
      message: "Request origin is not allowed.",
    });
  });
});
