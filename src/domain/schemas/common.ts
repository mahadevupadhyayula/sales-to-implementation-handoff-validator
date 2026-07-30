import { z } from "zod";

export const identifierSchema = z.string().trim().min(1).max(128).regex(/^[a-z0-9][a-z0-9._-]*$/);
export const nonEmptyTextSchema = z.string().trim().min(1);
export const timestampSchema = z.iso.datetime({ offset: true });
export const jsonValueSchema: z.ZodType<unknown> = z.json();
