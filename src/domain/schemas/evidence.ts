import { z } from "zod";
import { identifierSchema, nonEmptyTextSchema, timestampSchema } from "./common.js";

export const authorityLevels = [
  "executed_agreement",
  "approved_solution_design",
  "security_customer_requirements",
  "discovery_evidence",
  "crm",
  "informal_notes",
] as const;

export const authorityLevelSchema = z.enum(authorityLevels);
export type AuthorityLevel = z.infer<typeof authorityLevelSchema>;

export const authorityRank = Object.freeze(
  Object.fromEntries(authorityLevels.map((level, index) => [level, index])) as Record<AuthorityLevel, number>,
);

export function compareAuthority(left: AuthorityLevel, right: AuthorityLevel): number {
  return authorityRank[left] - authorityRank[right];
}

export const sourceLocationSchema = z.object({
  section: nonEmptyTextSchema,
  page: z.number().int().positive().optional(),
  paragraph: z.number().int().positive().optional(),
  jsonPointer: z.string().startsWith("/").optional(),
  excerpt: nonEmptyTextSchema.max(500),
}).refine((value) => value.page !== undefined || value.paragraph !== undefined || value.jsonPointer !== undefined, {
  message: "A citation location needs a page, paragraph, or JSON pointer",
});

export const sourceSchema = z.object({
  id: identifierSchema,
  dealId: identifierSchema,
  title: nonEmptyTextSchema,
  sourceType: z.enum(["agreement", "solution_design", "requirements", "discovery", "crm_record", "note"]),
  authorityLevel: authorityLevelSchema,
  recordDate: z.iso.date(),
  content: z.record(z.string(), z.unknown()),
  synthetic: z.literal(true),
}).superRefine((source, context) => {
  const expected: Record<typeof source.sourceType, AuthorityLevel> = {
    agreement: "executed_agreement", solution_design: "approved_solution_design",
    requirements: "security_customer_requirements", discovery: "discovery_evidence",
    crm_record: "crm", note: "informal_notes",
  };
  if (source.authorityLevel !== expected[source.sourceType]) context.addIssue({ code: "custom", path: ["authorityLevel"], message: "Authority level must match source type" });
});

export const citationSchema = z.object({
  id: identifierSchema,
  sourceId: identifierSchema,
  location: sourceLocationSchema,
});

export const epistemicStateSchema = z.enum(["confirmed", "assumption", "unresolved", "conflict", "ai_suggestion"]);
export const extractedFactSchema = z.object({
  id: identifierSchema,
  dealId: identifierSchema,
  field: nonEmptyTextSchema,
  value: z.unknown().refine((value) => value !== undefined, "Fact value is required"),
  state: epistemicStateSchema,
  citations: z.array(citationSchema).min(1, "Every extracted fact requires evidence"),
  extractedAt: timestampSchema,
});

export type Source = z.infer<typeof sourceSchema>;
export type Citation = z.infer<typeof citationSchema>;
export type ExtractedFact = z.infer<typeof extractedFactSchema>;
export type EpistemicState = z.infer<typeof epistemicStateSchema>;
