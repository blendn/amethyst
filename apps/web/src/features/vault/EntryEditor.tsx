import { useState } from "react";
import { Field } from "../../components/Field";
import { generatePassword, type VaultEntry } from "../../crypto";
import type { FolderRecord } from "../../state/vault-state";

export type EditorState = Pick<
  VaultEntry,
  "name" | "username" | "password" | "url" | "notes" | "favorite" | "folderId"
>;

export const emptyEditor: EditorState = {
  name: "",
  username: "",
  password: "",
  url: "",
  notes: "",
  favorite: false,
  folderId: null,
};

type EntryEditorProps = {
  initial: EditorState;
  folders: FolderRecord[];
  busy: boolean;
  onCancel: () => void;
  onSave: (editor: EditorState) => void;
};

export function EntryEditor({
  initial,
  folders,
  busy,
  onCancel,
  onSave,
}: EntryEditorProps) {
  const [editor, setEditor] = useState<EditorState>({ ...initial });

  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setEditor((current) => ({ ...current, [key]: value }));
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        className="card modal"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(editor);
        }}
      >
        <div className="modal-title">
          <div>
            <span className="eyebrow">ENCRYPTED LOGIN</span>
            <h2>{initial.name ? "Edit entry" : "New entry"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onCancel}>
            ×
          </button>
        </div>
        <Field
          label="Name"
          value={editor.name}
          onChange={(value) => update("name", value)}
          autoFocus
        />
        <div className="field-row">
          <Field
            label="Username"
            value={editor.username}
            onChange={(value) => update("username", value)}
          />
          <Field
            label="Website"
            type="url"
            value={editor.url}
            onChange={(value) => update("url", value)}
          />
        </div>
        <label className="field">
          <span>Password</span>
          <div className="password-field">
            <input
              required
              value={editor.password}
              onChange={(event) => update("password", event.target.value)}
            />
            <button
              type="button"
              onClick={() => update("password", generatePassword())}
            >
              Generate
            </button>
          </div>
        </label>
        <label className="field">
          <span>Folder</span>
          <select
            value={editor.folderId ?? ""}
            onChange={(event) => update("folderId", event.target.value || null)}
          >
            <option value="">No folder</option>
            {folders.map(({ folder }) => (
              <option key={folder.objectId} value={folder.objectId}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Secure notes</span>
          <textarea
            rows={4}
            value={editor.notes}
            onChange={(event) => update("notes", event.target.value)}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={editor.favorite}
            onChange={(event) => update("favorite", event.target.checked)}
          />{" "}
          Mark as favorite
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="primary compact"
            disabled={busy || !editor.name || !editor.password}
          >
            {busy ? "Encrypting…" : "Encrypt & save"}
          </button>
        </div>
      </form>
    </div>
  );
}
