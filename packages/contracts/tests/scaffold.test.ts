import { describe, expect, it } from 'vitest';

import { CONTRACTS_SCAFFOLD_NAME } from '../src/index.js';

describe('contracts scaffold', () => {
  it('exports its stable scaffold name', () => {
    expect(CONTRACTS_SCAFFOLD_NAME).toBe('museworks-contracts-scaffold');
  });
});
