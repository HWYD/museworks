import { z } from 'zod';

export const PROTOCOL_VERSION = 1 as const;
export const IPC_GET_APP_INFO = 'museworks:app:get-info' as const;

export const appInfoSchema = z.object({
  appVersion: z.string(),
  platform: z.enum(['win32', 'darwin']),
  arch: z.enum(['x64', 'arm64']),
});

export type AppInfo = z.infer<typeof appInfoSchema>;
