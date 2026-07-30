import "server-only";
import { readFile } from "node:fs/promises";
import { sourceFixtureSchema, type SourceFixture } from "../../domain/schemas/deal-room.js";

export async function loadSourceFixture(path: string): Promise<SourceFixture> {
  const raw: unknown = JSON.parse(await readFile(path, "utf8"));
  return sourceFixtureSchema.parse(raw);
}
