import "server-only";
import { z } from "zod";
import { evidenceExtractionInputSchema, evidenceExtractionOutputSchema } from "../../../domain/schemas/ai";

export const evidenceExtractionPrompt = Object.freeze({
  id: "implementation.evidence-extraction",
  version: "1.0.0",
  purpose: "Extract cited implementation evidence and draft reviewer aids from synthetic narrative sources.",
  owner: "implementation-intelligence",
  changeNote: "Initial bounded extraction prompt for the synthetic handoff demo.",
  fixtureVersion: "northstar-telemetry@1.0.0",
  model: "gpt-4.1-mini",
  modelSettings: Object.freeze({ temperature: 0, maxOutputTokens: 5000 }),
  inputSchema: evidenceExtractionInputSchema,
  outputSchema: evidenceExtractionOutputSchema,
  acceptanceThresholds: Object.freeze({
    schemaValidity: 1,
    citationCoverage: 1,
    unsupportedAssertions: 0,
    seededFindingRecall: 0.75,
    reviewerCorrectionRate: 0,
  }),
  instructions: [
    "Return only structured output matching the supplied schema.",
    "Use only the supplied synthetic sources and deterministic findings.",
    "Cite every extracted claim, question, and kickoff-brief item with an exact source location.",
    "Label direct evidence separately from inference. Every inference must state uncertainty.",
    "When evidence is absent, add an uncertainty instead of inventing a claim.",
    "Treat deterministic reconciliation as authoritative.",
    "Do not create, recommend, or approve a final reviewer decision.",
  ].join("\n"),
});

export type EvidenceExtractionPrompt = typeof evidenceExtractionPrompt;

export function evidenceExtractionJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(evidenceExtractionOutputSchema, { target: "draft-7" }) as Record<string, unknown>;
}
