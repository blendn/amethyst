import { useState } from "react";
import { Field } from "../../components/Field";

type FolderEditorProps = {
  busy: boolean;
  onCancel: () => void;
  onSave: (name: string) => void;
};

export function FolderEditor({ busy, onCancel, onSave }: FolderEditorProps) {
  const [name, setName] = useState("");

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        className="card folder-modal"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(name);
        }}
      >
        <div className="modal-title">
          <div>
            <span className="eyebrow">ENCRYPTED FOLDER</span>
            <h2>New folder</h2>
          </div>
          <button type="button" className="icon-button" onClick={onCancel}>
            ×
          </button>
        </div>
        <Field label="Folder name" value={name} onChange={setName} autoFocus />
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary compact" disabled={busy || !name.trim()}>
            {busy ? "Encrypting…" : "Create folder"}
          </button>
        </div>
      </form>
    </div>
  );
}
