import { describe, expect, it } from "vitest";
import type { SessionData } from "../api";
import type { EntryRecord, FolderRecord, VaultState } from "./vault-state";
import { initialVaultState, vaultReducer } from "./vault-state";

const session: SessionData = {
  userId: "8f1f7ab5-cf00-4ca6-b27d-ef5baaa49a54",
  email: "demo@example.com",
  kdfSalt: "MDEyMzQ1Njc4OWFiY2RlZg",
  kdfParams: {
    memoryKiB: 65_536,
    iterations: 3,
    parallelism: 1,
    hashLength: 32,
  },
  keyBundle: {
    version: 1,
    nonce: "AAAAAAAAAAAAAAAA",
    ciphertext: "encrypted-vault-key",
  },
};

const vaultKey = {} as CryptoKey;
const entries = [] as EntryRecord[];
const folders = [] as FolderRecord[];

function unlockedState(): VaultState {
  return vaultReducer(initialVaultState, {
    type: "AUTHENTICATED",
    session,
    vaultKey,
    entries,
    folders,
  });
}

describe("vault lifecycle reducer", () => {
  it("starts signed out without sensitive state", () => {
    expect(initialVaultState).toEqual({
      status: "signed-out",
      session: null,
      vaultKey: null,
      entries: [],
      folders: [],
    });
  });

  it("restores an authenticated session in the locked state", () => {
    expect(
      vaultReducer(initialVaultState, { type: "SESSION_RESTORED", session }),
    ).toEqual({
      status: "locked",
      session,
      vaultKey: null,
      entries: [],
      folders: [],
    });
  });

  it("accepts an unlock only from the locked state", () => {
    const locked = vaultReducer(initialVaultState, {
      type: "SESSION_RESTORED",
      session,
    });
    const unlocked = vaultReducer(locked, {
      type: "UNLOCK_SUCCEEDED",
      vaultKey,
      entries,
      folders,
    });

    expect(unlocked.status).toBe("unlocked");
    expect(unlocked.vaultKey).toBe(vaultKey);
    expect(
      vaultReducer(initialVaultState, {
        type: "UNLOCK_SUCCEEDED",
        vaultKey,
        entries,
        folders,
      }),
    ).toBe(initialVaultState);
  });

  it("clears the key and decrypted data when locking", () => {
    const locked = vaultReducer(unlockedState(), { type: "LOCK" });
    expect(locked).toEqual({
      status: "locked",
      session,
      vaultKey: null,
      entries: [],
      folders: [],
    });
  });

  it("updates decrypted collections only while unlocked", () => {
    const unlocked = unlockedState();
    const nextEntries = [{ marker: "entry" }] as unknown as EntryRecord[];
    const nextFolders = [{ marker: "folder" }] as unknown as FolderRecord[];

    expect(
      vaultReducer(unlocked, {
        type: "ENTRIES_UPDATED",
        entries: nextEntries,
      }),
    ).toMatchObject({ entries: nextEntries });
    expect(
      vaultReducer(unlocked, {
        type: "FOLDERS_UPDATED",
        folders: nextFolders,
      }),
    ).toMatchObject({ folders: nextFolders });
    expect(
      vaultReducer(initialVaultState, {
        type: "ENTRIES_UPDATED",
        entries: nextEntries,
      }),
    ).toBe(initialVaultState);
  });

  it("clears the session and all vault state on logout", () => {
    expect(vaultReducer(unlockedState(), { type: "LOGOUT" })).toBe(
      initialVaultState,
    );
  });
});
