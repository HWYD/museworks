// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { App } from '../src/renderer/app.js';

describe('desktop shell', () => {
  it('resets the document edge and prevents empty viewport overflow', () => {
    const rendererEntry = readFileSync(resolve('src/renderer/main.tsx'), 'utf8');
    const globalStyles = readFileSync(resolve('src/renderer/global.css'), 'utf8');

    expect(rendererEntry).toContain("import './global.css';");
    expect(globalStyles).toMatch(/html,[\s\S]*body,[\s\S]*#root[\s\S]*margin: 0;/);
    expect(globalStyles).toMatch(/body[\s\S]*overflow: hidden;/);
  });

  it('renders app information through the preload bridge', async () => {
    const getInfo = vi.fn().mockResolvedValue({
      appVersion: '0.0.0',
      platform: 'win32',
      arch: 'x64',
    });
    window.museworks = { app: { getInfo } };

    render(<App />);

    expect(await screen.findByText('Museworks 0.0.0')).toBeTruthy();
    expect(screen.getByText('win32 · x64')).toBeTruthy();
    expect(getInfo).toHaveBeenCalledTimes(1);
  });
});
