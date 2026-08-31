import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({ connectionString: config.DATABASE_URL });

export async function migrate(): Promise<void> {
  const sql = await readFile(
    fileURLToPath(
      new URL("../../../database/migrations/001_initial.sql", import.meta.url),
    ),
    "utf8",
  );
  await pool.query(sql);
}
