import "server-only";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function openDatabase(path = ":memory:"): Database.Database {
  const database = new Database(path);
  database.exec(readFileSync(join(process.cwd(), "migrations", "001_normalized_demo_state.sql"), "utf8"));
  return database;
}
