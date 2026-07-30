import "server-only";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { sourceFixtureSchema, type SourceFixture } from "../../domain/schemas/deal-room.js";
import { telemetryFixtureBundleSchema, type TelemetryFixtureBundle } from "../../domain/schemas/telemetry-fixture.js";

export async function loadSourceFixture(path: string): Promise<SourceFixture> {
  const raw: unknown = JSON.parse(await readFile(path, "utf8"));
  return sourceFixtureSchema.parse(raw);
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadTelemetryFixture(directory: string): Promise<TelemetryFixtureBundle> {
  const sourceDirectory = join(directory, "sources");
  const sourceFiles = (await readdir(sourceDirectory))
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));
  return telemetryFixtureBundleSchema.parse({
    manifest: await readJson(join(directory, "manifest.json")),
    seededGaps: await readJson(join(directory, "seeded-gaps.json")),
    expectedFindings: await readJson(join(directory, "expected-findings.json")),
    sources: await Promise.all(sourceFiles.map((name) => readJson(join(sourceDirectory, name)))),
  });
}
