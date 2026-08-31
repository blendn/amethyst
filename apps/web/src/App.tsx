import {
  useEffect,
  useReducer,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { api, type SessionData } from "./api";
import { Shell } from "./components/Shell";
import { deriveKeys, unwrapVaultKey } from "./crypto";
import { AuthScreen } from "./features/auth/AuthScreen";
import { UnlockScreen } from "./features/auth/UnlockScreen";
import { loadVault } from "./features/vault/loadVault";
import { VaultScreen } from "./features/vault/VaultScreen";
import {
  initialVaultState,
  vaultReducer,
  type EntryRecord,
  type FolderRecord,
} from "./state/vault-state";

export function App() {
  const [vaultState, dispatch] = useReducer(vaultReducer, initialVaultState);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .session()
      .then((session) => dispatch({ type: "SESSION_RESTORED", session }))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function unlock(masterPassword: string) {
    if (vaultState.status !== "locked") return;
    const { session } = vaultState;
    setBusy(true);
    setError("");
    try {
      const keys = await deriveKeys(
        masterPassword,
        session.kdfSalt,
        session.kdfParams,
      );
      const key = await unwrapVaultKey(
        keys.keyEncryptionKey,
        session.userId,
        session.kdfSalt,
        session.kdfParams,
        session.keyBundle,
      );
      keys.keyEncryptionKey.fill(0);
      const { entries, folders } = await loadVault(key, session);
      dispatch({
        type: "UNLOCK_SUCCEEDED",
        vaultKey: key,
        entries,
        folders,
      });
    } catch {
      setError("Unable to unlock the vault. Check the master password.");
    } finally {
      setBusy(false);
    }
  }

  async function completeAuthentication(data: SessionData, key: CryptoKey) {
    const { entries, folders } = await loadVault(key, data);
    dispatch({
      type: "AUTHENTICATED",
      session: data,
      vaultKey: key,
      entries,
      folders,
    });
  }

  function lock() {
    dispatch({ type: "LOCK" });
    setError("");
  }

  async function logout() {
    setBusy(true);
    try {
      await api.logout();
    } catch {
      /* Clear local state even if the session expired. */
    }
    dispatch({ type: "LOGOUT" });
    setBusy(false);
  }

  const setEntries: Dispatch<SetStateAction<EntryRecord[]>> = (update) => {
    if (vaultState.status !== "unlocked") return;
    const entries =
      typeof update === "function" ? update(vaultState.entries) : update;
    dispatch({ type: "ENTRIES_UPDATED", entries });
  };

  const setFolders: Dispatch<SetStateAction<FolderRecord[]>> = (update) => {
    if (vaultState.status !== "unlocked") return;
    const folders =
      typeof update === "function" ? update(vaultState.folders) : update;
    dispatch({ type: "FOLDERS_UPDATED", folders });
  };

  if (loading)
    return (
      <Shell>
        <div className="center-card">
          <div className="spinner" />
          Loading Amethyst…
        </div>
      </Shell>
    );

  if (vaultState.status === "signed-out") {
    return (
      <Shell>
        <AuthScreen
          busy={busy}
          error={error}
          setBusy={setBusy}
          setError={setError}
          onAuthenticated={completeAuthentication}
        />
      </Shell>
    );
  }

  if (vaultState.status === "locked") {
    return (
      <Shell>
        <UnlockScreen
          email={vaultState.session.email}
          busy={busy}
          error={error}
          onUnlock={unlock}
          onLogout={logout}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <VaultScreen
        session={vaultState.session}
        vaultKey={vaultState.vaultKey}
        entries={vaultState.entries}
        setEntries={setEntries}
        folders={vaultState.folders}
        setFolders={setFolders}
        busy={busy}
        setBusy={setBusy}
        error={error}
        setError={setError}
        onLock={lock}
        onLogout={logout}
      />
    </Shell>
  );
}
