import { access, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadSourceFixture, loadTelemetryFixture } from "../src/server/fixtures/load.js";

const root = resolve("fixtures/deal-rooms");
const scenarios = await readdir(root, { withFileTypes: true });
let count = 0;
for (const scenario of scenarios.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const directory = resolve(root, scenario.name);
  const sourceRecords = resolve(directory, "source-records.json");
  try {
    await access(sourceRecords);
    await loadSourceFixture(sourceRecords);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await loadTelemetryFixture(directory);
  }
  count += 1;
}
if (count === 0) throw new Error("No synthetic deal-room fixtures found");
console.log(`Validated ${count} synthetic deal-room fixture(s).`);
