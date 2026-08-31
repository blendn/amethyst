import type { VaultEnvelope } from "@amethyst/protocol";
import { api, type SessionData } from "../../api";
import {
  decryptVaultObject,
  type VaultEntry,
  type VaultFolder,
} from "../../crypto";

export async function loadVault(key: CryptoKey, session: SessionData) {
  const { objects } = await api.listObjects();
  const active = objects.filter((object) => object.deletedAt === null);
  const decrypted = await Promise.all(
    active.map(async (object) => ({
      envelope: object,
      object: await decryptVaultObject(key, session.userId, object),
    })),
  );
  const entries = decrypted
    .filter(
      (record): record is { envelope: VaultEnvelope; object: VaultEntry } =>
        record.object.objectType === "login",
    )
    .map(({ envelope, object }) => ({ envelope, entry: object }));
  const folders = decrypted
    .filter(
      (record): record is { envelope: VaultEnvelope; object: VaultFolder } =>
        record.object.objectType === "folder",
    )
    .map(({ envelope, object }) => ({ envelope, folder: object }));

  return { entries, folders };
}
