import { z } from 'zod';

export const workspaceIdSchema = z.string().uuid();

export const workspaceSchema = z
  .object({
    id: workspaceIdSchema,
    name: z.string().trim().min(1),
    rootPath: z.string().trim().min(1),
  })
  .strict();

export type Workspace = z.infer<typeof workspaceSchema>;
