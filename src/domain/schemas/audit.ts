import { z } from "zod";
import { identifierSchema, nonEmptyTextSchema, timestampSchema } from "./common.js";

export const promptRunAuditSchema = z.object({
  id: identifierSchema, dealId: identifierSchema,
  promptId: identifierSchema, promptVersion: nonEmptyTextSchema,
  adapterMode: z.enum(["mock", "openai"]), model: nonEmptyTextSchema,
  inputReference: nonEmptyTextSchema,
  status: z.enum(["succeeded", "failed"]),
  parsedOutput: z.unknown().optional(), failure: nonEmptyTextSchema.optional(),
  startedAt: timestampSchema, completedAt: timestampSchema,
}).superRefine((run, context) => {
  if (run.status === "succeeded" && run.parsedOutput === undefined) context.addIssue({ code: "custom", path: ["parsedOutput"], message: "Successful runs require parsed output" });
  if (run.status === "failed" && !run.failure) context.addIssue({ code: "custom", path: ["failure"], message: "Failed runs require failure details" });
});
export type PromptRunAudit = z.infer<typeof promptRunAuditSchema>;
