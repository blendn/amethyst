import { useState } from "react";
import { Field } from "../../components/Field";
import { IDLE_LOCK_MINUTES } from "../../state/idle-lock";

type UnlockScreenProps = {
  email: string;
  busy: boolean;
  error: string;
  lockReason: "idle" | "page-leave" | null;
  onUnlock: (password: string) => void;
  onLogout: () => void;
};

export function UnlockScreen({
  email,
  busy,
  error,
  lockReason,
  onUnlock,
  onLogout,
}: UnlockScreenProps) {
  const [password, setPassword] = useState("");

  return (
    <form
      className="card center-card unlock-card"
      onSubmit={(event) => {
        event.preventDefault();
        void onUnlock(password);
        setPassword("");
      }}
    >
      <div className="lock-icon">◆</div>
      <h2>Vault locked</h2>
      <p className="muted">Signed in as {email}</p>
      {lockReason && (
        <p className="muted">
          {lockReason === "idle"
            ? `Locked after ${IDLE_LOCK_MINUTES} minutes of inactivity.`
            : "Locked when you left the page."}
        </p>
      )}
      <Field
        label="Master password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        autoFocus
      />
      {error && <div className="error">{error}</div>}
      <button className="primary" disabled={busy}>
        {busy ? "Deriving secure keys…" : "Unlock"}
      </button>
      <button type="button" className="text-button" onClick={onLogout}>
        Sign out instead
      </button>
    </form>
  );
}
