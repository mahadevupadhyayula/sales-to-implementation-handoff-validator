import type { EvidenceExtractionOutput } from "../src/domain/schemas/ai";
import type { Citation } from "../src/domain/schemas/evidence";
import type { TelemetryFixtureBundle } from "../src/domain/schemas/telemetry-fixture";
import type { ReconciliationResult } from "../src/server/reconciliation/telemetry";

type MaterialItem = {
  id: string;
  citations: Citation[];
};

function resolvePointer(value: unknown, path: string): unknown {
  let current = value;
  for (const rawSegment of path.slice(1).split("/")) {
    const segment = rawSegment.replaceAll("~1", "/").replaceAll("~0", "~");
    if (typeof current !== "object" || current === null || !(segment in current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function displayValue(value: unknown): string {
  if (value === null) return "null";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function evaluateDemo(
  fixture: TelemetryFixtureBundle,
  reconciliation: ReconciliationResult,
  output: EvidenceExtractionOutput,
) {
  const materialItems: MaterialItem[] = [
    ...reconciliation.findings,
    ...output.extractedEvidence,
    ...output.clarificationQuestions,
    ...output.kickoffBrief.goals,
    ...output.kickoffBrief.scope,
    ...output.kickoffBrief.risks,
  ];
  const sources = new Map(fixture.sources.map((source) => [source.sourceId, source]));
  const invalidCitations = materialItems.flatMap((item) => item.citations.flatMap((citation) => {
    const source = sources.get(citation.sourceId);
    const pointer = citation.location.jsonPointer;
    const value = source && pointer ? resolvePointer(source, pointer) : undefined;
    return value === undefined || displayValue(value) !== citation.location.excerpt
      ? [{ itemId: item.id, sourceId: citation.sourceId, location: pointer ?? null }]
      : [];
  }));
  const uncitedMaterialItems = materialItems.filter(({ citations }) => citations.length === 0).map(({ id }) => id);
  const expectedById = new Map(fixture.expectedFindings.findings.map((finding) => [finding.findingId.toLowerCase(), finding]));
  const actualById = new Map(reconciliation.findings.map((finding) => [finding.id, finding]));
  const seededGapsFound = [...expectedById.keys()].filter((id) => actualById.has(id));
  const missedSeededGaps = [...expectedById.keys()].filter((id) => !actualById.has(id));
  const falsePositiveFindings = [...actualById.keys()].filter((id) => !expectedById.has(id));
  const mismatchedFindings = [...expectedById].flatMap(([id, expected]) => {
    const actual = actualById.get(id);
    if (!actual) return [];
    const mismatches = [
      actual.category !== expected.category && "category",
      actual.severity !== expected.severity && "severity",
      actual.state !== expected.epistemicState && "epistemicState",
      actual.summary !== expected.title && "title",
    ].filter((field): field is string => Boolean(field));
    return mismatches.length ? [{ findingId: id, fields: mismatches }] : [];
  });
  const unsupportedConfirmedAssertions = reconciliation.findings
    .filter((finding) => finding.state === "confirmed")
    .filter((finding) => finding.citations.length === 0 || invalidCitations.some(({ itemId }) => itemId === finding.id))
    .map(({ id }) => id);

  return {
    seededGapsFound,
    missedSeededGaps,
    falsePositiveFindings,
    mismatchedFindings,
    citationCoverage: materialItems.length === 0
      ? 0
      : (materialItems.length - uncitedMaterialItems.length) / materialItems.length,
    uncitedMaterialItems,
    invalidCitations,
    unsupportedConfirmedAssertions,
  };
}
