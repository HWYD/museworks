import { z } from 'zod';

import { workspaceIdSchema } from './workspace.js';

const entityIdSchema = z.string().uuid();
const nonEmptyTextSchema = z.string().trim().min(1);

export const creativeTaskSchema = z
  .object({
    id: entityIdSchema,
    workspaceId: workspaceIdSchema,
    title: nonEmptyTextSchema,
    direction: z.array(nonEmptyTextSchema).optional(),
  })
  .strict();

export const creativeRunStatusSchema = z.enum(['idle', 'running', 'completed', 'failed']);
export const runStepStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);

export const runStepSchema = z
  .object({
    id: nonEmptyTextSchema,
    label: nonEmptyTextSchema,
    status: runStepStatusSchema,
    summary: nonEmptyTextSchema.optional(),
  })
  .strict();

export const creativeRunSchema = z
  .object({
    id: entityIdSchema,
    taskId: entityIdSchema,
    instruction: nonEmptyTextSchema,
    status: creativeRunStatusSchema,
    steps: z.array(runStepSchema),
  })
  .strict();

export const artifactSchema = z
  .object({
    id: entityIdSchema,
    taskId: entityIdSchema,
    runId: entityIdSchema,
    type: z.literal('image'),
    uri: nonEmptyTextSchema,
  })
  .strict();

export const generationOptionsSchema = z
  .object({
    aspectRatio: z.literal('1:1'),
    candidateCount: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  })
  .strict();

export type CreativeTask = z.infer<typeof creativeTaskSchema>;
export type CreativeRunStatus = z.infer<typeof creativeRunStatusSchema>;
export type RunStepStatus = z.infer<typeof runStepStatusSchema>;
export type RunStep = z.infer<typeof runStepSchema>;
export type CreativeRun = z.infer<typeof creativeRunSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
export type GenerationOptions = z.infer<typeof generationOptionsSchema>;
