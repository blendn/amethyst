export type VaultEntry = {
  schemaVersion: 1;
  objectType: "login";
  objectId: string;
  name: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  favorite: boolean;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VaultFolder = {
  schemaVersion: 1;
  objectType: "folder";
  objectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type VaultObject = VaultEntry | VaultFolder;
