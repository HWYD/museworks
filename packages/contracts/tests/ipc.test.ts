import { describe, expect, it } from 'vitest';

import {
  appInfoSchema,
  IPC_ACTIVATE_WORKSPACE,
  IPC_GET_APP_INFO,
  IPC_LOAD_WORKSPACE,
  IPC_PICK_WORKSPACE,
  PROTOCOL_VERSION,
  workspaceActivationRequestSchema,
  workspaceLoadResultSchema,
  workspaceSelectionResultSchema,
  workspaceSnapshotSchema,
} from '../src/index.js';

describe('desktop IPC contract', () => {
  it('accepts only the supported app-info response shape', () => {
    expect(appInfoSchema.parse({ appVersion: '0.0.0', platform: 'win32', arch: 'x64' })).toEqual({
      appVersion: '0.0.0',
      platform: 'win32',
      arch: 'x64',
    });
    expect(() =>
      appInfoSchema.parse({ appVersion: '0.0.0', platform: 'linux', arch: 'x64' }),
    ).toThrow();
    expect(() =>
      appInfoSchema.parse({ appVersion: '0.0.0', platform: 'darwin', arch: 'ia32' }),
    ).toThrow();
    expect(() =>
      appInfoSchema.parse({
        appVersion: '0.0.0',
        platform: 'win32',
        arch: 'x64',
        diagnostic: 'unexpected',
      }),
    ).toThrow();
  });

  it('uses the versioned, named app-info capability', () => {
    expect(PROTOCOL_VERSION).toBe(1);
    expect(IPC_GET_APP_INFO).toBe('museworks:app:get-info');
  });

  it('uses named Workspace capabilities with validated snapshots and results', () => {
    const workspace = {
      id: '9f5f4e2e-08cb-41bc-99ff-e5a347bfebc7',
      name: 'summer-coffee',
      rootPath: 'D:\\MuseWorks\\summer-coffee',
    };

    expect(IPC_LOAD_WORKSPACE).toBe('museworks:workspace:load');
    expect(IPC_PICK_WORKSPACE).toBe('museworks:workspace:pick');
    expect(IPC_ACTIVATE_WORKSPACE).toBe('museworks:workspace:activate');
    expect(
      workspaceSnapshotSchema.parse({ currentWorkspace: workspace, recentWorkspaces: [workspace] }),
    ).toEqual({ currentWorkspace: workspace, recentWorkspaces: [workspace] });
    expect(workspaceActivationRequestSchema.parse({ workspaceId: workspace.id })).toEqual({
      workspaceId: workspace.id,
    });
    expect(
      workspaceLoadResultSchema.parse({
        status: 'loaded',
        snapshot: { currentWorkspace: workspace, recentWorkspaces: [workspace] },
      }),
    ).toEqual({
      status: 'loaded',
      snapshot: { currentWorkspace: workspace, recentWorkspaces: [workspace] },
    });
    expect(
      workspaceSelectionResultSchema.parse({
        status: 'selected',
        snapshot: { currentWorkspace: workspace, recentWorkspaces: [workspace] },
      }),
    ).toEqual({
      status: 'selected',
      snapshot: { currentWorkspace: workspace, recentWorkspaces: [workspace] },
    });
    expect(workspaceSelectionResultSchema.parse({ status: 'cancelled' })).toEqual({
      status: 'cancelled',
    });
    expect(
      workspaceSelectionResultSchema.parse({ status: 'error', code: 'invalid-workspace' }),
    ).toEqual({ status: 'error', code: 'invalid-workspace' });
  });

  it('rejects malformed workspace requests and results', () => {
    expect(() => workspaceActivationRequestSchema.parse({ workspaceId: 'not-a-uuid' })).toThrow();
    expect(() => workspaceLoadResultSchema.parse({ currentWorkspace: null })).toThrow();
    expect(() =>
      workspaceSelectionResultSchema.parse({ status: 'error', message: 'raw error' }),
    ).toThrow();
    expect(() =>
      workspaceSnapshotSchema.parse({
        currentWorkspace: null,
        recentWorkspaces: new Array(11).fill({}),
      }),
    ).toThrow();
  });
});
