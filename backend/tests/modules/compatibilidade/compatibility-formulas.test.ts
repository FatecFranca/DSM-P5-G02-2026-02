import { describe, expect, it } from 'vitest';

import {
  calculateCosineSimilarity,
  calculateWeightedThematicCoverage,
} from '../../../src/modules/compatibilidade/compatibility-formulas.js';

describe('fórmulas de compatibilidade temática', () => {
  it('caso A: priorização de Educação favorece o perfil concentrado em Educação', () => {
    const preferences = [{ themeCode: 46, weight: 5 }];

    expect(
      calculateCosineSimilarity(preferences, [{ code: 46, share: 1 }]),
    ).toBe(1);
    expect(
      calculateCosineSimilarity(preferences, [{ code: 56, share: 1 }]),
    ).toBe(0);
  });

  it('caso B: cosseno distingue equilíbrio onde cobertura ponderada empata', () => {
    const preferences = [
      { themeCode: 46, weight: 5 },
      { themeCode: 56, weight: 5 },
    ];
    const balanced = [
      { code: 46, share: 0.5 },
      { code: 56, share: 0.5 },
    ];
    const educationOnly = [{ code: 46, share: 1 }];

    expect(calculateWeightedThematicCoverage(preferences, balanced)).toBe(0.5);
    expect(calculateWeightedThematicCoverage(preferences, educationOnly)).toBe(
      0.5,
    );
    expect(calculateCosineSimilarity(preferences, balanced)).toBeCloseTo(1);
    expect(calculateCosineSimilarity(preferences, educationOnly)).toBeCloseTo(
      Math.SQRT1_2,
    );
  });

  it('caso C: volumes diferentes com a mesma distribuição geram o mesmo score', () => {
    const preferences = [
      { themeCode: 46, weight: 5 },
      { themeCode: 56, weight: 3 },
    ];
    const twentyDocuments = [
      { code: 46, share: 0.75 },
      { code: 56, share: 0.25 },
    ];
    const twoHundredDocuments = [
      { code: 46, share: 0.75 },
      { code: 56, share: 0.25 },
    ];

    expect(calculateCosineSimilarity(preferences, twentyDocuments)).toBe(
      calculateCosineSimilarity(preferences, twoHundredDocuments),
    );
  });

  it('trata vetor temático zero e mantém o score entre zero e um', () => {
    const preferences = [{ themeCode: 46, weight: 5 }];
    const score = calculateCosineSimilarity(preferences, [
      { code: 46, share: 0.2 },
      { code: 56, share: 0.8 },
    ]);

    expect(calculateCosineSimilarity(preferences, [])).toBe(0);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
