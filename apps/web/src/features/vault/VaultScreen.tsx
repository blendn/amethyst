import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { api, type SessionData } from "../../api";
import {
  encryptVaultObject,
  type VaultEntry,
  type VaultFolder,
} from "../../crypto";
import type { EntryRecord, FolderRecord } from "../../state/vault-state";
import { IDLE_LOCK_MINUTES } from "../../state/idle-lock";
import { EntryEditor, emptyEditor, type EditorState } from "./EntryEditor";
import { EntryIcon } from "./EntryIcon";
import { FolderEditor } from "./FolderEditor";

type VaultScreenProps = {
  session: SessionData;
  vaultKey: CryptoKey;
  entries: EntryRecord[];
  setEntries: Dispatch<SetStateAction<EntryRecord[]>>;
  folders: FolderRecord[];
  setFolders: Dispatch<SetStateAction<FolderRecord[]>>;
  busy: boolean;
  setBusy: (value: boolean) => void;
  error: string;
  setError: (value: string) => void;
  onLock: () => void;
  onLogout: () => void;
};

export function VaultScreen({
  session,
  vaultKey,
  entries,
  setEntries,
  folders,
  setFolders,
  busy,
  setBusy,
  error,
  setError,
  onLock,
  onLogout,
}: VaultScreenProps) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<EntryRecord | "new" | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [view, setView] = useState<"all" | "favorites" | string>("all");
  const sortedFolders = useMemo(
    () =>
      [...folders].sort((left, right) =>
        left.folder.name.localeCompare(right.folder.name),
      ),
    [folders],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return entries.filter(({ entry }) => {
      const inView =
        view === "all" ||
        (view === "favorites" ? entry.favorite : entry.folderId === view);
      const matches =
        !needle ||
        [entry.name, entry.username, entry.url].some((value) =>
          value.toLocaleLowerCase().includes(needle),
        );
      return inView && matches;
    });
  }, [entries, query, view]);
  const viewTitle =
    view === "all"
      ? "Your vault"
      : view === "favorites"
        ? "Favorites"
        : (folders.find(({ folder }) => folder.objectId === view)?.folder
            .name ?? "Folder");

  async function save(editor: EditorState) {
    setBusy(true);
    setError("");
    try {
      const now = new Date().toISOString();
      if (editing === "new") {
        const entry: VaultEntry = {
          schemaVersion: 1,
          objectType: "login",
          objectId: crypto.randomUUID(),
          ...editor,
          createdAt: now,
          updatedAt: now,
        };
        const encrypted = await encryptVaultObject(
          vaultKey,
          session.userId,
          entry,
        );
        const envelope = await api.createObject(encrypted);
        setEntries((current) => [{ entry, envelope }, ...current]);
      } else if (editing) {
        const entry: VaultEntry = {
          ...editing.entry,
          ...editor,
          updatedAt: now,
        };
        const encrypted = await encryptVaultObject(
          vaultKey,
          session.userId,
          entry,
        );
        const envelope = await api.updateObject(entry.objectId, {
          ...encrypted,
          expectedRevision: editing.envelope.revision,
        });
        setEntries((current) =>
          current.map((record) =>
            record.entry.objectId === entry.objectId
              ? { entry, envelope }
              : record,
          ),
        );
      }
      setEditing(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save entry.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(record: EntryRecord) {
    if (!window.confirm(`Delete “${record.entry.name}”?`)) return;
    setBusy(true);
    setError("");
    try {
      await api.deleteObject(record.entry.objectId, record.envelope.revision);
      setEntries((current) =>
        current.filter(({ entry }) => entry.objectId !== record.entry.objectId),
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not delete entry.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleFavorite(record: EntryRecord) {
    setBusy(true);
    setError("");
    try {
      const entry: VaultEntry = {
        ...record.entry,
        favorite: !record.entry.favorite,
        updatedAt: new Date().toISOString(),
      };
      const encrypted = await encryptVaultObject(
        vaultKey,
        session.userId,
        entry,
      );
      const envelope = await api.updateObject(entry.objectId, {
        ...encrypted,
        expectedRevision: record.envelope.revision,
      });
      setEntries((current) =>
        current.map((item) =>
          item.entry.objectId === entry.objectId ? { entry, envelope } : item,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not update favorite.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createFolder(name: string) {
    setBusy(true);
    setError("");
    try {
      const now = new Date().toISOString();
      const folder: VaultFolder = {
        schemaVersion: 1,
        objectType: "folder",
        objectId: crypto.randomUUID(),
        name: name.trim(),
        createdAt: now,
        updatedAt: now,
      };
      const encrypted = await encryptVaultObject(
        vaultKey,
        session.userId,
        folder,
      );
      const envelope = await api.createObject(encrypted);
      setFolders((current) => [...current, { folder, envelope }]);
      setView(folder.objectId);
      setCreatingFolder(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create folder.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeFolder(record: FolderRecord) {
    if (
      !window.confirm(
        `Delete “${record.folder.name}”? Entries inside it will move to All items.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const affected = entries.filter(
        ({ entry }) => entry.folderId === record.folder.objectId,
      );
      const moved = await Promise.all(
        affected.map(async (item) => {
          const entry: VaultEntry = {
            ...item.entry,
            folderId: null,
            updatedAt: new Date().toISOString(),
          };
          const encrypted = await encryptVaultObject(
            vaultKey,
            session.userId,
            entry,
          );
          const envelope = await api.updateObject(entry.objectId, {
            ...encrypted,
            expectedRevision: item.envelope.revision,
          });
          return { entry, envelope };
        }),
      );
      await api.deleteObject(record.folder.objectId, record.envelope.revision);
      const movedById = new Map(
        moved.map((item) => [item.entry.objectId, item]),
      );
      setEntries((current) =>
        current.map((item) => movedById.get(item.entry.objectId) ?? item),
      );
      setFolders((current) =>
        current.filter(
          ({ folder }) => folder.objectId !== record.folder.objectId,
        ),
      );
      if (view === record.folder.objectId) setView("all");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not delete folder.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="vault-layout">
      <aside>
        <div>
          <span className="side-label">VAULT</span>
          <button
            className={view === "all" ? "nav-active" : ""}
            onClick={() => setView("all")}
          >
            ◇ All items <strong>{entries.length}</strong>
          </button>
          <button
            className={view === "favorites" ? "nav-active" : ""}
            onClick={() => setView("favorites")}
          >
            ☆ Favorites{" "}
            <strong>
              {entries.filter(({ entry }) => entry.favorite).length}
            </strong>
          </button>
          <div className="folder-heading">
            <span className="side-label">FOLDERS</span>
            <button
              title="Create folder"
              onClick={() => setCreatingFolder(true)}
            >
              ＋
            </button>
          </div>
          <div className="folder-list">
            {sortedFolders.map((record) => (
              <div className="folder-row" key={record.folder.objectId}>
                <button
                  className={
                    view === record.folder.objectId ? "nav-active" : ""
                  }
                  onClick={() => setView(record.folder.objectId)}
                >
                  □ {record.folder.name}
                  <strong>
                    {
                      entries.filter(
                        ({ entry }) =>
                          entry.folderId === record.folder.objectId,
                      ).length
                    }
                  </strong>
                </button>
                <button
                  className="folder-delete"
                  title={`Delete ${record.folder.name}`}
                  disabled={busy}
                  onClick={() => void removeFolder(record)}
                >
                  ×
                </button>
              </div>
            ))}
            {folders.length === 0 && (
              <p className="folder-empty">No folders yet</p>
            )}
          </div>
        </div>
        <div className="account">
          <span>{session.email}</span>
          <button onClick={onLogout}>Sign out</button>
        </div>
      </aside>
      <div className="vault-main">
        <div className="vault-toolbar">
          <div>
            <h1>{viewTitle}</h1>
            <p className="muted">
              {filtered.length} {filtered.length === 1 ? "entry" : "entries"} ·
              decrypted locally · locks after {IDLE_LOCK_MINUTES} minutes of
              inactivity
            </p>
          </div>
          <div className="toolbar-actions">
            <button className="secondary" onClick={onLock}>
              ▣ Lock
            </button>
            <button
              className="primary compact"
              onClick={() => setEditing("new")}
            >
              ＋ New entry
            </button>
          </div>
        </div>
        <div className="search">
          <span>⌕</span>
          <input
            aria-label="Search vault"
            placeholder="Search names, usernames, and websites…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {error && <div className="error">{error}</div>}
        <div className="entry-list">
          {filtered.length === 0 ? (
            <div className="empty">
              <div>◇</div>
              <h3>
                {entries.length ? "No matching entries" : "Your vault is empty"}
              </h3>
              <p>
                {entries.length
                  ? "Try another search."
                  : "Create your first encrypted credential."}
              </p>
            </div>
          ) : (
            filtered.map((record) => (
              <article className="entry" key={record.entry.objectId}>
                <EntryIcon name={record.entry.name} url={record.entry.url} />
                <div className="entry-summary">
                  <strong>{record.entry.name}</strong>
                  <span>{record.entry.username || "No username"}</span>
                  <small>{record.entry.url}</small>
                </div>
                <code>
                  {revealed === record.entry.objectId
                    ? record.entry.password
                    : "••••••••••••"}
                </code>
                <button
                  className={`icon-button favorite${record.entry.favorite ? " active" : ""}`}
                  title={
                    record.entry.favorite
                      ? "Remove from favorites"
                      : "Add to favorites"
                  }
                  disabled={busy}
                  onClick={() => void toggleFavorite(record)}
                >
                  {record.entry.favorite ? "★" : "☆"}
                </button>
                <button
                  className="icon-button"
                  title="Reveal password"
                  onClick={() =>
                    setRevealed(
                      revealed === record.entry.objectId
                        ? null
                        : record.entry.objectId,
                    )
                  }
                >
                  ◉
                </button>
                <button
                  className="icon-button"
                  title="Edit"
                  onClick={() => setEditing(record)}
                >
                  ✎
                </button>
                <button
                  className="icon-button danger"
                  title="Delete"
                  disabled={busy}
                  onClick={() => void remove(record)}
                >
                  ×
                </button>
              </article>
            ))
          )}
        </div>
      </div>
      {editing && (
        <EntryEditor
          initial={
            editing === "new"
              ? {
                  ...emptyEditor,
                  folderId:
                    view !== "all" && view !== "favorites" ? view : null,
                }
              : editing.entry
          }
          folders={sortedFolders}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
      {creatingFolder && (
        <FolderEditor
          busy={busy}
          onCancel={() => setCreatingFolder(false)}
          onSave={createFolder}
        />
      )}
    </section>
  );
}
