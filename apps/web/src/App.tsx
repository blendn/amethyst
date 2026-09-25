import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
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
import { createIdleLock } from "./state/idle-lock";

type LockReason = "idle" | "page-leave" | null;

export function App() {
  const [vaultState, dispatch] = useReducer(vaultReducer, initialVaultState);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lockReason, setLockReason] = useState<LockReason>(null);
  const lifecycle = useRef(0);

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
    const attempt = lifecycle.current;
    setBusy(true);
    setError("");
    let keyEncryptionKey: Uint8Array<ArrayBuffer> | null = null;
    try {
      const keys = await deriveKeys(
        masterPassword,
        session.kdfSalt,
        session.kdfParams,
      );
      keyEncryptionKey = keys.keyEncryptionKey;
      if (lifecycle.current !== attempt) return;
      const key = await unwrapVaultKey(
        keys.keyEncryptionKey,
        session.userId,
        session.kdfSalt,
        session.kdfParams,
        session.keyBundle,
      );
      if (lifecycle.current !== attempt) return;
      const { entries, folders } = await loadVault(key, session);
      if (lifecycle.current !== attempt) return;
      dispatch({
        type: "UNLOCK_SUCCEEDED",
        vaultKey: key,
        entries,
        folders,
      });
      setLockReason(null);
    } catch {
      if (lifecycle.current === attempt)
        setError("Unable to unlock the vault. Check the master password.");
    } finally {
      keyEncryptionKey?.fill(0);
      if (lifecycle.current === attempt) setBusy(false);
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
    setLockReason(null);
  }

  const lock = useCallback((reason: LockReason) => {
    lifecycle.current += 1;
    dispatch({ type: "LOCK" });
    setLockReason(reason);
    setBusy(false);
    setError("");
  }, []);

  useEffect(() => {
    if (vaultState.status !== "unlocked") return;
    const idle = createIdleLock(() => lock("idle"));
    const activity = (event: Event) => {
      if (!idle.activity()) return;
      // Prevent the first late action from reaching the stale unlocked view.
      if (event.cancelable) event.preventDefault();
      event.stopImmediatePropagation();
    };
    const resume = () => idle.check();
    const visibility = () => {
      if (document.visibilityState === "visible") resume();
    };
    const pageHide = () => lock("page-leave");

    window.addEventListener("pointerdown", activity, true);
    window.addEventListener("click", activity, true);
    window.addEventListener("keydown", activity, true);
    window.addEventListener("touchstart", activity, true);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("pagehide", pageHide);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      idle.dispose();
      window.removeEventListener("pointerdown", activity, true);
      window.removeEventListener("click", activity, true);
      window.removeEventListener("keydown", activity, true);
      window.removeEventListener("touchstart", activity, true);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("pagehide", pageHide);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [vaultState.status, lock]);

  async function logout() {
    lifecycle.current += 1;
    dispatch({ type: "LOGOUT" });
    setLockReason(null);
    setBusy(false);
    setError("");
    setLoggingOut(true);
    try {
      await api.logout();
    } catch {
      /* Clear local state even if the session expired. */
    } finally {
      setLoggingOut(false);
    }
  }

  const renderLifecycle = lifecycle.current;
  const setEntries: Dispatch<SetStateAction<EntryRecord[]>> = (update) => {
    if (
      vaultState.status !== "unlocked" ||
      lifecycle.current !== renderLifecycle
    )
      return;
    const entries =
      typeof update === "function" ? update(vaultState.entries) : update;
    dispatch({ type: "ENTRIES_UPDATED", entries });
  };

  const setFolders: Dispatch<SetStateAction<FolderRecord[]>> = (update) => {
    if (
      vaultState.status !== "unlocked" ||
      lifecycle.current !== renderLifecycle
    )
      return;
    const folders =
      typeof update === "function" ? update(vaultState.folders) : update;
    dispatch({ type: "FOLDERS_UPDATED", folders });
  };
  const setVaultBusy = (value: boolean) => {
    if (lifecycle.current === renderLifecycle) setBusy(value);
  };
  const setVaultError = (value: string) => {
    if (lifecycle.current === renderLifecycle) setError(value);
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

  if (loggingOut)
    return (
      <Shell>
        <div className="center-card">
          <div className="spinner" />
          Signing out…
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
          lockReason={lockReason}
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
        setBusy={setVaultBusy}
        error={error}
        setError={setVaultError}
        onLock={() => lock(null)}
        onLogout={logout}
      />
    </Shell>
  );
}
