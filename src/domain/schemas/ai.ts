import { z } from "zod";
import { identifierSchema, nonEmptyTextSchema } from "./common";
import { citationSchema, extractedFactSchema } from "./evidence";
import { telemetryFixtureBundleSchema } from "./telemetry-fixture";
import { findingSchema } from "./workflow";

const confidenceSchema = z.number().min(0).max(1);

export const aiExtractedEvidenceSchema = z.object({
  id: identifierSchema,
  field: nonEmptyTextSchema,
  value: nonEmptyTextSchema,
  evidenceBasis: z.enum(["direct", "inference"]),
  confidence: confidenceSchema,
  uncertainty: nonEmptyTextSchema.optional(),
  citations: z.array(citationSchema).min(1, "AI claims require source evidence"),
}).superRefine((item, context) => {
  if (item.evidenceBasis === "inference" && !item.uncertainty) {
    context.addIssue({ code: "custom", path: ["uncertainty"], message: "Inferences must state their uncertainty" });
  }
});

export const aiUncertaintySchema = z.object({
  id: identifierSchema,
  topic: nonEmptyTextSchema,
  reason: nonEmptyTextSchema,
  searchedSourceIds: z.array(identifierSchema).min(1),
});

export const aiClarificationQuestionSchema = z.object({
  id: identifierSchema,
  question: nonEmptyTextSchema,
  rationale: nonEmptyTextSchema,
  relatedFindingIds: z.array(identifierSchema).min(1),
  citations: z.array(citationSchema).min(1),
});

export const kickoffBriefItemSchema = z.object({
  id: identifierSchema,
  text: nonEmptyTextSchema,
  evidenceBasis: z.enum(["direct", "inference"]),
  confidence: confidenceSchema,
  uncertainty: nonEmptyTextSchema.optional(),
  citations: z.array(citationSchema).min(1),
}).superRefine((item, context) => {
  if (item.evidenceBasis === "inference" && !item.uncertainty) {
    context.addIssue({ code: "custom", path: ["uncertainty"], message: "Inferred kickoff brief items must state their uncertainty" });
  }
});

export const evidenceExtractionOutputSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  dealId: identifierSchema,
  extractedEvidence: z.array(aiExtractedEvidenceSchema),
  uncertainties: z.array(aiUncertaintySchema),
  clarificationQuestions: z.array(aiClarificationQuestionSchema),
  kickoffBrief: z.object({
    summary: nonEmptyTextSchema,
    goals: z.array(kickoffBriefItemSchema),
    scope: z.array(kickoffBriefItemSchema),
    risks: z.array(kickoffBriefItemSchema),
  }),
  authority: z.literal("ai_suggestion"),
  reviewerDecision: z.never().optional(),
});

export const evidenceExtractionInputSchema = z.object({
  fixture: telemetryFixtureBundleSchema,
  reconciliation: z.object({
    dealId: identifierSchema,
    facts: z.array(extractedFactSchema),
    findings: z.array(findingSchema),
    checksRun: z.object({
      required_field: z.number().int().nonnegative(),
      conflict: z.number().int().nonnegative(),
      dependency: z.number().int().nonnegative(),
      checklist: z.number().int().nonnegative(),
    }),
  }),
}).superRefine(({ fixture, reconciliation }, context) => {
  if (fixture.manifest.dealId !== reconciliation.dealId) {
    context.addIssue({ code: "custom", message: "Fixture and reconciliation deal IDs must match" });
  }
});

export type EvidenceExtractionOutput = z.infer<typeof evidenceExtractionOutputSchema>;
export type EvidenceExtractionInput = z.infer<typeof evidenceExtractionInputSchema>;
