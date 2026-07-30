import { expect, test } from "@playwright/test";

const decisions: ReadonlyArray<{ name: string; rationale: boolean; expectedTasks?: string }> = [
  { name: "Accept", rationale: false, expectedTasks: "0" },
  { name: "Accept with conditions", rationale: true },
  { name: "Return for clarification", rationale: true },
  { name: "Escalate", rationale: true },
];

test.describe("implementation-manager approval gate", () => {
  for (const decision of decisions) {
    test(`${decision.name} produces a visible simulated controlled output`, async ({ page }) => {
      await page.goto("/handoffs/deal-nhl-2027-001");
      await page.getByRole("button", { name: "Decision & output" }).click();
      await expect(page.getByText("Decision controls are locked")).toBeVisible();
      await expect(page.getByRole("button", { name: /Approve decision/ })).toBeDisabled();

      await page.getByRole("button", { name: "Readiness report" }).click();
      const findings = page.locator(".finding-row");
      const findingCount = await findings.count();
      for (let index = 0; index < findingCount; index += 1) {
        await findings.nth(index).evaluate((element: HTMLElement) => element.click());
        await page.getByLabel("Assigned owner").selectOption({ label: "Implementation lead" });
        const reviewButton = page.getByRole("button", { name: "Mark reviewed" });
        if (await reviewButton.isVisible()) await reviewButton.click();
        else await page.getByRole("button", { name: "Close" }).click();
      }

      await page.getByRole("button", { name: /Continue to decision/ }).click();
      await page.getByRole("button", { name: decision.name, exact: true }).click();
      if (decision.rationale) {
        await page.getByLabel(/Decision rationale/).fill("The implementation manager reviewed the evidence and approved this controlled outcome.");
      }
      await page.getByRole("button", { name: "Approve decision & prepare output" }).click();

      await expect(page.getByText("Approved · simulated")).toBeVisible();
      await expect(page.getByText("Decision record")).toBeVisible();
      await expect(page.getByText("Approved baseline")).toBeVisible();
      await expect(page.getByText("Clarification tasks & owners")).toBeVisible();
      await expect(page.getByText("Internal kickoff brief").last()).toBeVisible();
      await expect(page.getByText("Approved preview only. Nothing was sent to an external system.")).toBeVisible();
      if (decision.expectedTasks) {
        await expect(page.getByText(decision.expectedTasks, { exact: true })).toBeVisible();
      }
    });
  }
});
