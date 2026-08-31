import type { VaultEnvelope } from "@amethyst/protocol";
import type { SessionData } from "../api";
import type { VaultEntry, VaultFolder } from "../crypto";

export type EntryRecord = {
  entry: VaultEntry;
  envelope: VaultEnvelope;
};

export type FolderRecord = {
  folder: VaultFolder;
  envelope: VaultEnvelope;
};

export type SignedOutState = {
  status: "signed-out";
  session: null;
  vaultKey: null;
  entries: [];
  folders: [];
};

export type LockedState = {
  status: "locked";
  session: SessionData;
  vaultKey: null;
  entries: [];
  folders: [];
};

export type UnlockedState = {
  status: "unlocked";
  session: SessionData;
  vaultKey: CryptoKey;
  entries: EntryRecord[];
  folders: FolderRecord[];
};

export type VaultState = SignedOutState | LockedState | UnlockedState;

export type VaultAction =
  | { type: "SESSION_RESTORED"; session: SessionData }
  | {
      type: "AUTHENTICATED";
      session: SessionData;
      vaultKey: CryptoKey;
      entries: EntryRecord[];
      folders: FolderRecord[];
    }
  | {
      type: "UNLOCK_SUCCEEDED";
      vaultKey: CryptoKey;
      entries: EntryRecord[];
      folders: FolderRecord[];
    }
  | { type: "ENTRIES_UPDATED"; entries: EntryRecord[] }
  | { type: "FOLDERS_UPDATED"; folders: FolderRecord[] }
  | { type: "LOCK" }
  | { type: "LOGOUT" };

export const initialVaultState: SignedOutState = {
  status: "signed-out",
  session: null,
  vaultKey: null,
  entries: [],
  folders: [],
};

export function vaultReducer(
  state: VaultState,
  action: VaultAction,
): VaultState {
  switch (action.type) {
    case "SESSION_RESTORED":
      return {
        status: "locked",
        session: action.session,
        vaultKey: null,
        entries: [],
        folders: [],
      };

    case "AUTHENTICATED":
      return {
        status: "unlocked",
        session: action.session,
        vaultKey: action.vaultKey,
        entries: action.entries,
        folders: action.folders,
      };

    case "UNLOCK_SUCCEEDED":
      if (state.status !== "locked") return state;
      return {
        status: "unlocked",
        session: state.session,
        vaultKey: action.vaultKey,
        entries: action.entries,
        folders: action.folders,
      };

    case "ENTRIES_UPDATED":
      if (state.status !== "unlocked") return state;
      return { ...state, entries: action.entries };

    case "FOLDERS_UPDATED":
      if (state.status !== "unlocked") return state;
      return { ...state, folders: action.folders };

    case "LOCK":
      if (state.status !== "unlocked") return state;
      return {
        status: "locked",
        session: state.session,
        vaultKey: null,
        entries: [],
        folders: [],
      };

    case "LOGOUT":
      return initialVaultState;
  }
}
