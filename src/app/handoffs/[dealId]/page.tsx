import { notFound } from "next/navigation";
import { join } from "node:path";
import { ReviewWorkspace } from "@/components/reviewer/review-workspace";
import { loadTelemetryFixture } from "@/server/fixtures/load";
import { reconcileTelemetryFixture } from "@/server/reconciliation/telemetry";

export default async function HandoffPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const fixture = await loadTelemetryFixture(join(process.cwd(), "fixtures", "deal-rooms", "northstar-telemetry"));
  if (dealId !== fixture.manifest.dealId) notFound();

  const reconciliation = reconcileTelemetryFixture(fixture);
  return <ReviewWorkspace fixture={fixture} findings={reconciliation.findings} />;
}
