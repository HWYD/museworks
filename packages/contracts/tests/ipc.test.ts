import { describe, expect, it } from 'vitest';

import { appInfoSchema, IPC_GET_APP_INFO, PROTOCOL_VERSION } from '../src/index.js';

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
  });

  it('uses the versioned, named app-info capability', () => {
    expect(PROTOCOL_VERSION).toBe(1);
    expect(IPC_GET_APP_INFO).toBe('museworks:app:get-info');
  });
});
