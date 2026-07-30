import "server-only";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const migrationPath = fileURLToPath(new URL("../../../migrations/001_normalized_demo_state.sql", import.meta.url));

export function openDatabase(path = ":memory:"): DatabaseSync {
  const database = new DatabaseSync(path);
  database.exec(readFileSync(migrationPath, "utf8"));
  return database;
}
