import { describe, expect, it } from 'vitest';

import { DESKTOP_SCAFFOLD_NAME } from '../src/renderer/placeholder.js';

describe('desktop scaffold', () => {
  it('exports its stable scaffold name', () => {
    expect(DESKTOP_SCAFFOLD_NAME).toBe('museworks-desktop-scaffold');
  });
});
