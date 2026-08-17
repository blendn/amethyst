import type { KdfParams, KeyBundle, VaultEnvelope } from "@amethyst/protocol";

export type PreloginResponse = {
  userId: string;
  kdfSalt: string;
  kdfParams: KdfParams;
  authSchemeVersion: 1;
  registration: boolean;
  registrationToken?: string;
};

export type SessionData = {
  userId: string;
  email: string;
  kdfSalt: string;
  kdfParams: KdfParams;
  keyBundle: KeyBundle;
};

type ApiErrorBody = { error?: string; message?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.message ?? `Request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  prelogin: (email: string) =>
    request<PreloginResponse>("/auth/prelogin", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  register: (body: {
    registrationToken: string;
    email: string;
    loginSecret: string;
    kdfSalt: string;
    kdfParams: KdfParams;
    keyBundle: KeyBundle;
  }) =>
    request<{ userId: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (email: string, loginSecret: string) =>
    request<SessionData>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, loginSecret }),
    }),
  session: () => request<SessionData>("/auth/session"),
  logout: () => request<void>("/auth/logout", { method: "POST", body: "{}" }),
  listObjects: () => request<{ objects: VaultEnvelope[] }>("/vault/objects"),
  createObject: (body: {
    id: string;
    version: 1;
    nonce: string;
    ciphertext: string;
  }) =>
    request<VaultEnvelope>("/vault/objects", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateObject: (
    id: string,
    body: {
      version: 1;
      nonce: string;
      ciphertext: string;
      expectedRevision: number;
    },
  ) =>
    request<VaultEnvelope>(`/vault/objects/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteObject: (id: string, expectedRevision: number) =>
    request<void>(`/vault/objects/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ expectedRevision }),
    }),
};
