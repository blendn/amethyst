import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DEMO_WARNING, type VaultEnvelope } from "@amethyst/protocol";
import { api, type SessionData } from "./api";
import {
  createVaultKeyBundle,
  decryptVaultObject,
  deriveKeys,
  encryptVaultObject,
  generatePassword,
  unwrapVaultKey,
  type VaultEntry,
  type VaultFolder,
} from "./crypto";

type EntryRecord = { entry: VaultEntry; envelope: VaultEnvelope };
type FolderRecord = { folder: VaultFolder; envelope: VaultEnvelope };
type EditorState = Pick<VaultEntry, "name" | "username" | "password" | "url" | "notes" | "favorite" | "folderId">;

const emptyEditor: EditorState = {
  name: "", username: "", password: "", url: "", notes: "", favorite: false, folderId: null,
};

export function App() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [entries, setEntries] = useState<EntryRecord[]>([]);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.session().then(setSession).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  async function loadVault(key: CryptoKey, data: SessionData) {
    const { objects } = await api.listObjects();
    const active = objects.filter((object) => object.deletedAt === null);
    const decrypted = await Promise.all(active.map(async (object) => ({
      envelope: object,
      object: await decryptVaultObject(key, data.userId, object),
    })));
    setEntries(decrypted
      .filter((record): record is { envelope: VaultEnvelope; object: VaultEntry } => record.object.objectType === "login")
      .map(({ envelope, object }) => ({ envelope, entry: object })));
    setFolders(decrypted
      .filter((record): record is { envelope: VaultEnvelope; object: VaultFolder } => record.object.objectType === "folder")
      .map(({ envelope, object }) => ({ envelope, folder: object })));
  }

  async function unlock(masterPassword: string) {
    if (!session) return;
    setBusy(true); setError("");
    try {
      const keys = await deriveKeys(masterPassword, session.kdfSalt, session.kdfParams);
      const key = await unwrapVaultKey(keys.keyEncryptionKey, session.userId, session.kdfSalt, session.kdfParams, session.keyBundle);
      keys.keyEncryptionKey.fill(0);
      await loadVault(key, session);
      setVaultKey(key);
    } catch {
      setError("Unable to unlock the vault. Check the master password.");
    } finally {
      setBusy(false);
    }
  }

  async function completeAuthentication(data: SessionData, key: CryptoKey) {
    await loadVault(key, data);
    setSession(data);
    setVaultKey(key);
  }

  function lock() {
    setVaultKey(null);
    setEntries([]);
    setFolders([]);
    setError("");
  }

  async function logout() {
    setBusy(true);
    try { await api.logout(); } catch { /* Clear local state even if the session expired. */ }
    setVaultKey(null); setEntries([]); setFolders([]); setSession(null); setBusy(false);
  }

  if (loading) return <Shell><div className="center-card"><div className="spinner" />Loading Amethyst…</div></Shell>;

  if (!session) {
    return <Shell><AuthScreen busy={busy} error={error} setBusy={setBusy} setError={setError} onAuthenticated={completeAuthentication} /></Shell>;
  }

  if (!vaultKey) {
    return <Shell><UnlockScreen email={session.email} busy={busy} error={error} onUnlock={unlock} onLogout={logout} /></Shell>;
  }

  return <Shell><VaultScreen
    session={session}
    vaultKey={vaultKey}
    entries={entries}
    setEntries={setEntries}
    folders={folders}
    setFolders={setFolders}
    busy={busy}
    setBusy={setBusy}
    error={error}
    setError={setError}
    onLock={lock}
    onLogout={logout}
  /></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = window.localStorage.getItem("amethyst-theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("amethyst-theme", theme);
  }, [theme]);

  return <div className="app-shell">
    <div className="demo-notice">
      <button type="button" className="demo-banner">{DEMO_WARNING}</button>
    </div>
    <header>
      <div className="brand"><span className="gem">◆</span> Amethyst</div>
      <div className="header-actions">
        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </div>
    </header>
    <main>{children}</main>
  </div>;
}

function AuthScreen({ busy, error, setBusy, setError, onAuthenticated }: {
  busy: boolean; error: string; setBusy: (value: boolean) => void; setError: (value: string) => void;
  onAuthenticated: (session: SessionData, key: CryptoKey) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (mode === "register" && password !== confirm) { setError("Master passwords do not match."); return; }
    if (password.length < 12) { setError("Use a master password with at least 12 characters for this demo."); return; }
    setBusy(true);
    try {
      const prelogin = await api.prelogin(email);
      if (mode === "register") {
        if (!prelogin.registration || !prelogin.registrationToken) throw new Error("An account already exists for this email.");
        const keys = await deriveKeys(password, prelogin.kdfSalt, prelogin.kdfParams);
        const { vaultKey, keyBundle } = await createVaultKeyBundle(keys.keyEncryptionKey, prelogin.userId, prelogin.kdfSalt, prelogin.kdfParams);
        await api.register({
          registrationToken: prelogin.registrationToken, email, loginSecret: keys.loginSecret,
          kdfSalt: prelogin.kdfSalt, kdfParams: prelogin.kdfParams, keyBundle,
        });
        const session = await api.login(email, keys.loginSecret);
        keys.keyEncryptionKey.fill(0);
        await onAuthenticated(session, vaultKey);
      } else {
        if (prelogin.registration) throw new Error("No account exists for this email.");
        const keys = await deriveKeys(password, prelogin.kdfSalt, prelogin.kdfParams);
        const session = await api.login(email, keys.loginSecret);
        const key = await unwrapVaultKey(keys.keyEncryptionKey, session.userId, session.kdfSalt, session.kdfParams, session.keyBundle);
        keys.keyEncryptionKey.fill(0);
        await onAuthenticated(session, key);
      }
      setPassword(""); setConfirm("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request failed.");
    } finally { setBusy(false); }
  }

  return <section className="auth-layout">
    <form className="card auth-card" onSubmit={submit}>
      <div className="tabs"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button><button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Create account</button></div>
      <h2>{mode === "login" ? "Sign in" : "Create account"}</h2>
      {mode === "register" && <p className="muted">Your master password cannot be recovered.</p>}
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field label="Master password" type="password" value={password} onChange={setPassword} autoComplete={mode === "login" ? "current-password" : "new-password"} />
      {mode === "register" && <Field label="Confirm master password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />}
      {error && <div className="error">{error}</div>}
      <button className="primary" disabled={busy}>{busy ? "Deriving secure keys…" : mode === "login" ? "Unlock vault" : "Create encrypted vault"}</button>
    </form>
  </section>;
}

function UnlockScreen({ email, busy, error, onUnlock, onLogout }: { email: string; busy: boolean; error: string; onUnlock: (password: string) => void; onLogout: () => void }) {
  const [password, setPassword] = useState("");
  return <form className="card center-card unlock-card" onSubmit={(event) => { event.preventDefault(); void onUnlock(password); setPassword(""); }}>
    <div className="lock-icon">◆</div><h2>Vault locked</h2><p className="muted">Signed in as {email}</p>
    <Field label="Master password" type="password" value={password} onChange={setPassword} autoComplete="current-password" autoFocus />
    {error && <div className="error">{error}</div>}
    <button className="primary" disabled={busy}>{busy ? "Deriving secure keys…" : "Unlock"}</button>
    <button type="button" className="text-button" onClick={onLogout}>Sign out instead</button>
  </form>;
}

function VaultScreen({ session, vaultKey, entries, setEntries, folders, setFolders, busy, setBusy, error, setError, onLock, onLogout }: {
  session: SessionData; vaultKey: CryptoKey; entries: EntryRecord[]; setEntries: React.Dispatch<React.SetStateAction<EntryRecord[]>>;
  folders: FolderRecord[]; setFolders: React.Dispatch<React.SetStateAction<FolderRecord[]>>;
  busy: boolean; setBusy: (value: boolean) => void; error: string; setError: (value: string) => void; onLock: () => void; onLogout: () => void;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<EntryRecord | "new" | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [view, setView] = useState<"all" | "favorites" | string>("all");
  const sortedFolders = useMemo(() => [...folders].sort((left, right) => left.folder.name.localeCompare(right.folder.name)), [folders]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return entries.filter(({ entry }) => {
      const inView = view === "all" || (view === "favorites" ? entry.favorite : entry.folderId === view);
      const matches = !needle || [entry.name, entry.username, entry.url].some((value) => value.toLocaleLowerCase().includes(needle));
      return inView && matches;
    });
  }, [entries, query, view]);
  const viewTitle = view === "all" ? "Your vault" : view === "favorites" ? "Favorites" : folders.find(({ folder }) => folder.objectId === view)?.folder.name ?? "Folder";

  async function save(editor: EditorState) {
    setBusy(true); setError("");
    try {
      const now = new Date().toISOString();
      if (editing === "new") {
        const entry: VaultEntry = { schemaVersion: 1, objectType: "login", objectId: crypto.randomUUID(), ...editor, createdAt: now, updatedAt: now };
        const encrypted = await encryptVaultObject(vaultKey, session.userId, entry);
        const envelope = await api.createObject(encrypted);
        setEntries((current) => [{ entry, envelope }, ...current]);
      } else if (editing) {
        const entry: VaultEntry = { ...editing.entry, ...editor, updatedAt: now };
        const encrypted = await encryptVaultObject(vaultKey, session.userId, entry);
        const envelope = await api.updateObject(entry.objectId, { ...encrypted, expectedRevision: editing.envelope.revision });
        setEntries((current) => current.map((record) => record.entry.objectId === entry.objectId ? { entry, envelope } : record));
      }
      setEditing(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save entry."); }
    finally { setBusy(false); }
  }

  async function remove(record: EntryRecord) {
    if (!window.confirm(`Delete “${record.entry.name}”?`)) return;
    setBusy(true); setError("");
    try {
      await api.deleteObject(record.entry.objectId, record.envelope.revision);
      setEntries((current) => current.filter(({ entry }) => entry.objectId !== record.entry.objectId));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not delete entry."); }
    finally { setBusy(false); }
  }

  async function toggleFavorite(record: EntryRecord) {
    setBusy(true); setError("");
    try {
      const entry: VaultEntry = { ...record.entry, favorite: !record.entry.favorite, updatedAt: new Date().toISOString() };
      const encrypted = await encryptVaultObject(vaultKey, session.userId, entry);
      const envelope = await api.updateObject(entry.objectId, { ...encrypted, expectedRevision: record.envelope.revision });
      setEntries((current) => current.map((item) => item.entry.objectId === entry.objectId ? { entry, envelope } : item));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update favorite."); }
    finally { setBusy(false); }
  }

  async function createFolder(name: string) {
    setBusy(true); setError("");
    try {
      const now = new Date().toISOString();
      const folder: VaultFolder = { schemaVersion: 1, objectType: "folder", objectId: crypto.randomUUID(), name: name.trim(), createdAt: now, updatedAt: now };
      const encrypted = await encryptVaultObject(vaultKey, session.userId, folder);
      const envelope = await api.createObject(encrypted);
      setFolders((current) => [...current, { folder, envelope }]);
      setView(folder.objectId);
      setCreatingFolder(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create folder."); }
    finally { setBusy(false); }
  }

  async function removeFolder(record: FolderRecord) {
    if (!window.confirm(`Delete “${record.folder.name}”? Entries inside it will move to All items.`)) return;
    setBusy(true); setError("");
    try {
      const affected = entries.filter(({ entry }) => entry.folderId === record.folder.objectId);
      const moved = await Promise.all(affected.map(async (item) => {
        const entry: VaultEntry = { ...item.entry, folderId: null, updatedAt: new Date().toISOString() };
        const encrypted = await encryptVaultObject(vaultKey, session.userId, entry);
        const envelope = await api.updateObject(entry.objectId, { ...encrypted, expectedRevision: item.envelope.revision });
        return { entry, envelope };
      }));
      await api.deleteObject(record.folder.objectId, record.envelope.revision);
      const movedById = new Map(moved.map((item) => [item.entry.objectId, item]));
      setEntries((current) => current.map((item) => movedById.get(item.entry.objectId) ?? item));
      setFolders((current) => current.filter(({ folder }) => folder.objectId !== record.folder.objectId));
      if (view === record.folder.objectId) setView("all");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not delete folder."); }
    finally { setBusy(false); }
  }

  return <section className="vault-layout">
    <aside><div>
      <span className="side-label">VAULT</span>
      <button className={view === "all" ? "nav-active" : ""} onClick={() => setView("all")}>◇ All items <strong>{entries.length}</strong></button>
      <button className={view === "favorites" ? "nav-active" : ""} onClick={() => setView("favorites")}>☆ Favorites <strong>{entries.filter(({ entry }) => entry.favorite).length}</strong></button>
      <div className="folder-heading"><span className="side-label">FOLDERS</span><button title="Create folder" onClick={() => setCreatingFolder(true)}>＋</button></div>
      <div className="folder-list">
        {sortedFolders.map((record) => <div className="folder-row" key={record.folder.objectId}>
          <button className={view === record.folder.objectId ? "nav-active" : ""} onClick={() => setView(record.folder.objectId)}>□ {record.folder.name}<strong>{entries.filter(({ entry }) => entry.folderId === record.folder.objectId).length}</strong></button>
          <button className="folder-delete" title={`Delete ${record.folder.name}`} disabled={busy} onClick={() => void removeFolder(record)}>×</button>
        </div>)}
        {folders.length === 0 && <p className="folder-empty">No folders yet</p>}
      </div>
    </div><div className="account"><span>{session.email}</span><button onClick={onLogout}>Sign out</button></div></aside>
    <div className="vault-main">
      <div className="vault-toolbar"><div><h1>{viewTitle}</h1><p className="muted">{filtered.length} {filtered.length === 1 ? "entry" : "entries"} · decrypted locally</p></div><div className="toolbar-actions"><button className="secondary" onClick={onLock}>▣ Lock</button><button className="primary compact" onClick={() => setEditing("new")}>＋ New entry</button></div></div>
      <div className="search"><span>⌕</span><input aria-label="Search vault" placeholder="Search names, usernames, and websites…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      {error && <div className="error">{error}</div>}
      <div className="entry-list">
        {filtered.length === 0 ? <div className="empty"><div>◇</div><h3>{entries.length ? "No matching entries" : "Your vault is empty"}</h3><p>{entries.length ? "Try another search." : "Create your first encrypted credential."}</p></div> : filtered.map((record) => <article className="entry" key={record.entry.objectId}>
          <EntryIcon name={record.entry.name} url={record.entry.url} /><div className="entry-summary"><strong>{record.entry.name}</strong><span>{record.entry.username || "No username"}</span><small>{record.entry.url}</small></div>
          <code>{revealed === record.entry.objectId ? record.entry.password : "••••••••••••"}</code>
          <button className={`icon-button favorite${record.entry.favorite ? " active" : ""}`} title={record.entry.favorite ? "Remove from favorites" : "Add to favorites"} disabled={busy} onClick={() => void toggleFavorite(record)}>{record.entry.favorite ? "★" : "☆"}</button>
          <button className="icon-button" title="Reveal password" onClick={() => setRevealed(revealed === record.entry.objectId ? null : record.entry.objectId)}>◉</button>
          <button className="icon-button" title="Edit" onClick={() => setEditing(record)}>✎</button>
          <button className="icon-button danger" title="Delete" disabled={busy} onClick={() => void remove(record)}>×</button>
        </article>)}
      </div>
    </div>
    {editing && <EntryEditor initial={editing === "new" ? { ...emptyEditor, folderId: view !== "all" && view !== "favorites" ? view : null } : editing.entry} folders={sortedFolders} busy={busy} onCancel={() => setEditing(null)} onSave={save} />}
    {creatingFolder && <FolderEditor busy={busy} onCancel={() => setCreatingFolder(false)} onSave={createFolder} />}
  </section>;
}

function EntryIcon({ name, url }: { name: string; url: string }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const faviconSources = useMemo(() => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return [];
      return [
        new URL("/favicon.ico", parsed.origin).toString(),
        `https://icons.duckduckgo.com/ip3/${encodeURIComponent(parsed.hostname)}.ico`,
      ];
    } catch {
      return [];
    }
  }, [url]);

  useEffect(() => setSourceIndex(0), [faviconSources]);

  const favicon = faviconSources[sourceIndex];

  return <div className="entry-icon" aria-hidden="true">
    {favicon
      ? <img src={favicon} alt="" referrerPolicy="no-referrer" onError={() => setSourceIndex((current) => current + 1)} />
      : name.slice(0, 1).toUpperCase()}
  </div>;
}

function EntryEditor({ initial, folders, busy, onCancel, onSave }: { initial: EditorState; folders: FolderRecord[]; busy: boolean; onCancel: () => void; onSave: (editor: EditorState) => void }) {
  const [editor, setEditor] = useState<EditorState>({ ...initial });
  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) { setEditor((current) => ({ ...current, [key]: value })); }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><form className="card modal" onSubmit={(event) => { event.preventDefault(); void onSave(editor); }}><div className="modal-title"><div><span className="eyebrow">ENCRYPTED LOGIN</span><h2>{initial.name ? "Edit entry" : "New entry"}</h2></div><button type="button" className="icon-button" onClick={onCancel}>×</button></div>
    <Field label="Name" value={editor.name} onChange={(value) => update("name", value)} autoFocus />
    <div className="field-row"><Field label="Username" value={editor.username} onChange={(value) => update("username", value)} /><Field label="Website" type="url" value={editor.url} onChange={(value) => update("url", value)} /></div>
    <label className="field"><span>Password</span><div className="password-field"><input required value={editor.password} onChange={(event) => update("password", event.target.value)} /><button type="button" onClick={() => update("password", generatePassword())}>Generate</button></div></label>
    <label className="field"><span>Folder</span><select value={editor.folderId ?? ""} onChange={(event) => update("folderId", event.target.value || null)}><option value="">No folder</option>{folders.map(({ folder }) => <option key={folder.objectId} value={folder.objectId}>{folder.name}</option>)}</select></label>
    <label className="field"><span>Secure notes</span><textarea rows={4} value={editor.notes} onChange={(event) => update("notes", event.target.value)} /></label>
    <label className="check"><input type="checkbox" checked={editor.favorite} onChange={(event) => update("favorite", event.target.checked)} /> Mark as favorite</label>
    <div className="modal-actions"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary compact" disabled={busy || !editor.name || !editor.password}>{busy ? "Encrypting…" : "Encrypt & save"}</button></div>
  </form></div>;
}

function FolderEditor({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <form className="card folder-modal" onSubmit={(event) => { event.preventDefault(); void onSave(name); }}>
      <div className="modal-title"><div><span className="eyebrow">ENCRYPTED FOLDER</span><h2>New folder</h2></div><button type="button" className="icon-button" onClick={onCancel}>×</button></div>
      <Field label="Folder name" value={name} onChange={setName} autoFocus />
      <div className="modal-actions"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary compact" disabled={busy || !name.trim()}>{busy ? "Encrypting…" : "Create folder"}</button></div>
    </form>
  </div>;
}

function Field({ label, type = "text", value, onChange, autoComplete, autoFocus = false }: { label: string; type?: string; value: string; onChange: (value: string) => void; autoComplete?: string; autoFocus?: boolean }) {
  return <label className="field"><span>{label}</span><input required type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} autoFocus={autoFocus} /></label>;
}
