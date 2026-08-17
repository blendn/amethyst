import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({ connectionString: config.DATABASE_URL });

export async function migrate(): Promise<void> {
  const sql = await readFile(
    resolve("database/migrations/001_initial.sql"),
    "utf8",
  );
  await pool.query(sql);
}
