"use server";

import { createControlledOutput } from "@/server/decisions/controlled-output";
import { openDatabase } from "@/server/db/database";
import { persistDecisionPackage } from "@/server/db/deal-state-repository";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export async function approveHandoffDecision(input: unknown) {
  const result = createControlledOutput(input, new Date().toISOString());
  const dataDirectory = join(process.cwd(), ".data");
  mkdirSync(dataDirectory, { recursive: true });
  const database = openDatabase(join(dataDirectory, "handoff-decisions.db"));
  try {
    persistDecisionPackage(database, result.decision, result.output);
  } finally {
    database.close();
  }
  return result;
}
