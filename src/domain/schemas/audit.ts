import { z } from "zod";
import { identifierSchema, jsonValueSchema, nonEmptyTextSchema, timestampSchema } from "./common.js";

export const promptRunAuditSchema = z.object({
  id: identifierSchema, dealId: identifierSchema,
  promptId: identifierSchema, promptVersion: nonEmptyTextSchema,
  adapterMode: z.enum(["mock", "openai"]), model: nonEmptyTextSchema,
  modelSettings: z.record(z.string(), jsonValueSchema),
  fixtureVersion: nonEmptyTextSchema,
  inputReference: nonEmptyTextSchema,
  status: z.enum(["succeeded", "failed"]),
  rawOutput: nonEmptyTextSchema.optional(),
  parsedOutput: jsonValueSchema.optional(),
  validationResult: z.enum(["valid", "invalid"]),
  failure: nonEmptyTextSchema.optional(),
  startedAt: timestampSchema, completedAt: timestampSchema,
}).superRefine((run, context) => {
  if (run.status === "succeeded" && (run.parsedOutput === undefined || run.validationResult !== "valid")) {
    context.addIssue({ code: "custom", path: ["parsedOutput"], message: "Successful runs require valid parsed output" });
  }
  if (run.status === "failed" && (!run.failure || run.validationResult !== "invalid")) {
    context.addIssue({ code: "custom", path: ["failure"], message: "Failed runs require invalid status and failure details" });
  }
});
export type PromptRunAudit = z.infer<typeof promptRunAuditSchema>;
