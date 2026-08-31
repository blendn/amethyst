import { useState, type FormEvent } from "react";
import { api, type SessionData } from "../../api";
import { Field } from "../../components/Field";
import { createVaultKeyBundle, deriveKeys, unwrapVaultKey } from "../../crypto";

type AuthScreenProps = {
  busy: boolean;
  error: string;
  setBusy: (value: boolean) => void;
  setError: (value: string) => void;
  onAuthenticated: (session: SessionData, key: CryptoKey) => Promise<void>;
};

export function AuthScreen({
  busy,
  error,
  setBusy,
  setError,
  onAuthenticated,
}: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (mode === "register" && password !== confirm) {
      setError("Master passwords do not match.");
      return;
    }
    if (password.length < 12) {
      setError(
        "Use a master password with at least 12 characters for this demo.",
      );
      return;
    }
    setBusy(true);
    try {
      const prelogin = await api.prelogin(email);
      if (mode === "register") {
        if (!prelogin.registration || !prelogin.registrationToken)
          throw new Error("An account already exists for this email.");
        const keys = await deriveKeys(
          password,
          prelogin.kdfSalt,
          prelogin.kdfParams,
        );
        const { vaultKey, keyBundle } = await createVaultKeyBundle(
          keys.keyEncryptionKey,
          prelogin.userId,
          prelogin.kdfSalt,
          prelogin.kdfParams,
        );
        await api.register({
          registrationToken: prelogin.registrationToken,
          email,
          loginSecret: keys.loginSecret,
          kdfSalt: prelogin.kdfSalt,
          kdfParams: prelogin.kdfParams,
          keyBundle,
        });
        const session = await api.login(email, keys.loginSecret);
        keys.keyEncryptionKey.fill(0);
        await onAuthenticated(session, vaultKey);
      } else {
        if (prelogin.registration)
          throw new Error("No account exists for this email.");
        const keys = await deriveKeys(
          password,
          prelogin.kdfSalt,
          prelogin.kdfParams,
        );
        const session = await api.login(email, keys.loginSecret);
        const key = await unwrapVaultKey(
          keys.keyEncryptionKey,
          session.userId,
          session.kdfSalt,
          session.kdfParams,
          session.keyBundle,
        );
        keys.keyEncryptionKey.fill(0);
        await onAuthenticated(session, key);
      }
      setPassword("");
      setConfirm("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The request failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-layout">
      <form className="card auth-card" onSubmit={submit}>
        <div className="tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            Create account
          </button>
        </div>
        <h2>{mode === "login" ? "Sign in" : "Create account"}</h2>
        {mode === "register" && (
          <p className="muted">Your master password cannot be recovered.</p>
        )}
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <Field
          label="Master password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        {mode === "register" && (
          <Field
            label="Confirm master password"
            type="password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
        )}
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={busy}>
          {busy
            ? "Deriving secure keys…"
            : mode === "login"
              ? "Unlock vault"
              : "Create encrypted vault"}
        </button>
      </form>
    </section>
  );
}
