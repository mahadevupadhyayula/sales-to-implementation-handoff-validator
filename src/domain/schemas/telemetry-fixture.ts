import { z } from "zod";
import { identifierSchema, nonEmptyTextSchema, timestampSchema } from "./common.js";

const schemaVersion = z.literal("1.0.0");
const findingIdSchema = z.string().regex(/^FND-\d{3}$/);

export const telemetrySourceTypeSchema = z.enum([
  "crm_opportunity",
  "executed_commercial_document",
  "solution_design",
  "security_data_requirement",
  "discovery_call_summary",
  "sales_handoff_note",
  "implementation_readiness_checklist",
]);

export const telemetrySourceSchema = z.object({
  schemaVersion,
  sourceId: identifierSchema,
  dealId: identifierSchema,
  sourceType: telemetrySourceTypeSchema,
  title: nonEmptyTextSchema,
  synthetic: z.literal(true),
  version: nonEmptyTextSchema,
  recordedAt: timestampSchema,
  recordedBy: z.object({
    name: nonEmptyTextSchema,
    role: nonEmptyTextSchema,
    organization: nonEmptyTextSchema,
  }),
  content: z.record(z.string(), z.unknown()),
});

export const telemetryManifestSchema = z.object({
  schemaVersion,
  scenarioId: identifierSchema,
  title: nonEmptyTextSchema,
  synthetic: z.literal(true),
  dealId: identifierSchema,
  status: z.literal("closed_won"),
  asOf: timestampSchema,
  sourceRecordIds: z.array(identifierSchema).min(1),
  expectedFindingCount: z.number().int().nonnegative(),
  notice: nonEmptyTextSchema,
});

export const expectedFindingCitationSchema = z.object({
  sourceId: identifierSchema,
  location: z.string().startsWith("/"),
  excerpt: nonEmptyTextSchema.max(500),
});

export const expectedFindingSchema = z.object({
  findingId: findingIdSchema,
  category: identifierSchema,
  severity: z.enum(["critical", "high", "medium", "low"]),
  epistemicState: z.enum(["confirmed", "assumption", "unresolved", "conflict", "ai_suggestion"]),
  title: nonEmptyTextSchema,
  expectedDisposition: z.enum(["accept", "accept_with_conditions", "return_for_clarification", "escalate"]),
  citations: z.array(expectedFindingCitationSchema).min(1),
});

export const telemetryExpectedFindingsSchema = z.object({
  schemaVersion,
  scenarioId: identifierSchema,
  evaluationOnly: z.literal(true),
  findingCount: z.number().int().nonnegative(),
  findings: z.array(expectedFindingSchema),
});

export const telemetrySeededGapsSchema = z.object({
  schemaVersion,
  scenarioId: identifierSchema,
  purpose: nonEmptyTextSchema,
  seededFindingIds: z.array(findingIdSchema),
});

export const telemetryFixtureBundleSchema = z.object({
  manifest: telemetryManifestSchema,
  sources: z.array(telemetrySourceSchema).min(1),
  seededGaps: telemetrySeededGapsSchema,
  expectedFindings: telemetryExpectedFindingsSchema,
}).superRefine((bundle, context) => {
  const { manifest, sources, seededGaps, expectedFindings } = bundle;
  if (seededGaps.scenarioId !== manifest.scenarioId || expectedFindings.scenarioId !== manifest.scenarioId) {
    context.addIssue({ code: "custom", message: "All telemetry fixture files must use the manifest scenarioId" });
  }
  if (sources.some((source) => source.dealId !== manifest.dealId)) {
    context.addIssue({ code: "custom", message: "All telemetry sources must use the manifest dealId" });
  }
  const sourceIds = new Set(sources.map((source) => source.sourceId));
  if (sourceIds.size !== sources.length) context.addIssue({ code: "custom", message: "Telemetry source IDs must be unique" });
  for (const sourceId of manifest.sourceRecordIds) {
    if (!sourceIds.has(sourceId)) context.addIssue({ code: "custom", message: `Manifest references unknown source ${sourceId}` });
  }
  if (manifest.sourceRecordIds.length !== sourceIds.size) {
    context.addIssue({ code: "custom", message: "Manifest must enumerate every source exactly once" });
  }
  if (manifest.expectedFindingCount !== expectedFindings.findingCount || expectedFindings.findingCount !== expectedFindings.findings.length) {
    context.addIssue({ code: "custom", message: "Expected finding counts must agree" });
  }
  const expectedIds = new Set(expectedFindings.findings.map((finding) => finding.findingId));
  if (expectedIds.size !== expectedFindings.findings.length) context.addIssue({ code: "custom", message: "Expected finding IDs must be unique" });
  if (seededGaps.seededFindingIds.length !== expectedIds.size || seededGaps.seededFindingIds.some((id) => !expectedIds.has(id))) {
    context.addIssue({ code: "custom", message: "Seeded gap IDs must exactly match expected finding IDs" });
  }
  for (const finding of expectedFindings.findings) {
    for (const citation of finding.citations) {
      if (!sourceIds.has(citation.sourceId)) context.addIssue({ code: "custom", message: `Finding ${finding.findingId} cites unknown source ${citation.sourceId}` });
    }
  }
});

export type TelemetrySource = z.infer<typeof telemetrySourceSchema>;
export type TelemetryFixtureBundle = z.infer<typeof telemetryFixtureBundleSchema>;
