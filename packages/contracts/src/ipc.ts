import { z } from 'zod';

import { workspaceIdSchema, workspaceSchema } from './workspace.js';

export const PROTOCOL_VERSION = 1 as const;
export const IPC_GET_APP_INFO = 'museworks:app:get-info' as const;
export const IPC_LOAD_WORKSPACE = 'museworks:workspace:load' as const;
export const IPC_PICK_WORKSPACE = 'museworks:workspace:pick' as const;
export const IPC_ACTIVATE_WORKSPACE = 'museworks:workspace:activate' as const;

export const appInfoSchema = z
  .object({
    appVersion: z.string(),
    platform: z.enum(['win32', 'darwin']),
    arch: z.enum(['x64', 'arm64']),
  })
  .strict();

export type AppInfo = z.infer<typeof appInfoSchema>;

export const workspaceSnapshotSchema = z
  .object({
    currentWorkspace: workspaceSchema.nullable(),
    recentWorkspaces: z.array(workspaceSchema).max(10),
  })
  .strict();

export const workspaceActivationRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
  })
  .strict();

export const workspaceErrorCodeSchema = z.enum([
  'invalid-workspace',
  'workspace-storage-unavailable',
]);

export const workspaceLoadResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('loaded'),
      snapshot: workspaceSnapshotSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal('error'),
      code: workspaceErrorCodeSchema,
    })
    .strict(),
]);

export const workspaceSelectionResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('selected'),
      snapshot: workspaceSnapshotSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal('cancelled'),
    })
    .strict(),
  z
    .object({
      status: z.literal('error'),
      code: workspaceErrorCodeSchema,
    })
    .strict(),
]);

export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;
export type WorkspaceActivationRequest = z.infer<typeof workspaceActivationRequestSchema>;
export type WorkspaceErrorCode = z.infer<typeof workspaceErrorCodeSchema>;
export type WorkspaceLoadResult = z.infer<typeof workspaceLoadResultSchema>;
export type WorkspaceSelectionResult = z.infer<typeof workspaceSelectionResultSchema>;
