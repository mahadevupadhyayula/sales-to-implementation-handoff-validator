import { describe, expect, it } from "vitest";
import { aiExtractedEvidenceSchema, evidenceExtractionOutputSchema, kickoffBriefItemSchema } from "../../src/domain/schemas/ai.js";

const citation = {
  id: "citation-1",
  sourceId: "source-1",
  location: { section: "Narrative", jsonPointer: "/content/goal", excerpt: "Reduce manual work" },
};

describe("AI extraction schemas", () => {
  it("requires cited evidence and explicit uncertainty for inference", () => {
    expect(() => aiExtractedEvidenceSchema.parse({
      id: "claim-1", field: "goal", value: "Reduce manual work",
      evidenceBasis: "inference", confidence: 0.8, citations: [citation],
    })).toThrow(/uncertainty/i);
    expect(() => aiExtractedEvidenceSchema.parse({
      id: "claim-1", field: "goal", value: "Reduce manual work",
      evidenceBasis: "direct", confidence: 0.8, citations: [],
    })).toThrow(/evidence/i);
  });

  it("does not permit a model-created reviewer decision", () => {
    expect(() => evidenceExtractionOutputSchema.parse({
      schemaVersion: "1.0.0", dealId: "deal-1", extractedEvidence: [], uncertainties: [],
      clarificationQuestions: [], kickoffBrief: { summary: "Draft", goals: [], scope: [], risks: [] },
      authority: "ai_suggestion", reviewerDecision: "accept",
    })).toThrow();
  });

  it("requires uncertainty on inferred kickoff brief items", () => {
    expect(() => kickoffBriefItemSchema.parse({
      id: "brief-1", text: "Connector support may be incomplete",
      evidenceBasis: "inference", confidence: 0.7, citations: [citation],
    })).toThrow(/uncertainty/i);
    expect(kickoffBriefItemSchema.parse({
      id: "brief-1", text: "Connector support may be incomplete",
      evidenceBasis: "inference", confidence: 0.7,
      uncertainty: "No field-level sample was provided.", citations: [citation],
    }).uncertainty).toMatch(/sample/);
  });
});
