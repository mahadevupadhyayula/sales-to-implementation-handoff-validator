import "server-only";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migrationPath = fileURLToPath(new URL("../../../migrations/001_normalized_demo_state.sql", import.meta.url));

export function openDatabase(path = ":memory:"): Database.Database {
  const database = new Database(path);
  database.exec(readFileSync(migrationPath, "utf8"));
  return database;
}
