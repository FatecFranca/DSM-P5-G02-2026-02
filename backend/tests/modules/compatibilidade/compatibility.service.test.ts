import { describe, expect, it } from 'vitest';

import { CompatibilityInvalidPreferencesError } from '../../../src/modules/compatibilidade/compatibility.errors.js';
import { CompatibilityService } from '../../../src/modules/compatibilidade/compatibility.service.js';
import type {
  ComparableProfiles,
  ThemeProfilesProvider,
} from '../../../src/modules/compatibilidade/theme-profile.types.js';

const profiles: ComparableProfiles = {
  source: 'CAMARA',
  period: { startYear: 2023, endYear: 2025 },
  parliamentariansConsidered: 4,
  profilesCompared: 3,
  profilesExcludedWithoutThemes: 1,
  documentsAnalyzed: 240,
  documentsWithThemes: 230,
  coverage: 230 / 240,
  themesObserved: 2,
  profiles: [
    {
      parliamentarian: { id: 30, name: 'C', party: null, uf: 'RJ' },
      source: 'CAMARA',
      period: { startYear: 2023, endYear: 2025 },
      documentsAnalyzed: 200,
      documentsWithThemes: 200,
      documentsWithoutThemes: 0,
      coverage: 1,
      themes: [{ code: 56, name: 'Saúde', documentCount: 200, share: 1 }],
      evidence: [],
    },
    {
      parliamentarian: { id: 20, name: 'B', party: 'B', uf: 'MG' },
      source: 'CAMARA',
      period: { startYear: 2023, endYear: 2025 },
      documentsAnalyzed: 20,
      documentsWithThemes: 10,
      documentsWithoutThemes: 10,
      coverage: 0.5,
      themes: [{ code: 46, name: 'Educação', documentCount: 10, share: 1 }],
      evidence: [],
    },
    {
      parliamentarian: { id: 10, name: 'A', party: 'A', uf: 'SP' },
      source: 'CAMARA',
      period: { startYear: 2023, endYear: 2025 },
      documentsAnalyzed: 20,
      documentsWithThemes: 20,
      documentsWithoutThemes: 0,
      coverage: 1,
      themes: [{ code: 46, name: 'Educação', documentCount: 20, share: 1 }],
      evidence: [],
    },
  ],
};

function createProvider(data = profiles): ThemeProfilesProvider {
  return {
    getComparableProfiles: () => Promise.resolve(data),
    getEvidence: () =>
      Promise.resolve([
        {
          parliamentarianId: 20,
          proposalId: 900,
          themeCode: 46,
          title: 'Dispõe sobre educação pública.',
          source: 'CAMARA',
        },
      ]),
  };
}

describe('CompatibilityService', () => {
  it('propaga o modo temático sem alterar o cálculo de similaridade', async () => {
    let profileSource: unknown;
    let evidenceSource: unknown;
    const provider = createProvider();
    provider.getComparableProfiles = (period, themeSource) => {
      profileSource = { period, themeSource };
      return Promise.resolve({ ...profiles, themeSource: 'official' });
    };
    provider.getEvidence = (period, ids, codes, themeSource) => {
      evidenceSource = { period, ids, codes, themeSource };
      return Promise.resolve([]);
    };

    const response = await new CompatibilityService(provider).rank({
      source: 'CAMARA',
      themeSource: 'official',
      preferences: [{ themeCode: 46, weight: 5 }],
    });

    expect(response.themeSource).toBe('official');
    expect(profileSource).toEqual({
      period: { startYear: 2023, endYear: 2025 },
      themeSource: 'official',
    });
    expect(evidenceSource).toMatchObject({ themeSource: 'official' });
    expect(response.results[0]?.compatibility).toBe(1);
  });

  it('ordena por score, cobertura e externalId e retorna explicação estruturada', async () => {
    const service = new CompatibilityService(createProvider());

    const response = await service.rank({
      source: 'CAMARA',
      period: { startYear: 2023, endYear: 2025 },
      preferences: [
        { themeCode: 46, weight: 5 },
        { themeCode: 56, weight: 1 },
      ],
      limit: 5,
    });

    expect(response.method).toBe('cosine_similarity');
    expect(response.themeSource).toBe('official');
    expect(
      response.results.map(({ parliamentarian }) => parliamentarian.id),
    ).toEqual([10, 20, 30]);
    expect(response.results[0]).toMatchObject({
      position: 1,
      compatibility: 5 / Math.sqrt(26),
      compatibilityPercent: 98.06,
      documentsAnalyzed: 20,
      coverage: 1,
      matchedThemes: [
        {
          code: 46,
          name: 'Educação',
          userWeight: 5,
          parliamentarianShare: 1,
        },
        {
          code: 56,
          name: 'Saúde',
          userWeight: 1,
          parliamentarianShare: 0,
        },
      ],
    });
    expect(response.results[1]?.evidence).toEqual([
      {
        proposalId: 900,
        themeCode: 46,
        title: 'Dispõe sobre educação pública.',
        source: 'CAMARA',
      },
    ]);
    expect(response.summary).toEqual({
      parliamentariansConsidered: 4,
      profilesCompared: 3,
      profilesExcludedWithoutThemes: 1,
      documentsAnalyzed: 240,
      documentsWithThemes: 230,
      coverage: 230 / 240,
      themesObserved: 2,
    });
  });

  it('respeita limit customizado e o default de cinco', async () => {
    const repeatedProfiles: ComparableProfiles = {
      ...profiles,
      parliamentariansConsidered: 6,
      profilesCompared: 6,
      profilesExcludedWithoutThemes: 0,
      documentsAnalyzed: 1_200,
      documentsWithThemes: 1_200,
      coverage: 1,
      themesObserved: 1,
      profiles: Array.from({ length: 6 }, (_, index) => ({
        ...profiles.profiles[0],
        parliamentarian: {
          id: index + 1,
          name: `Deputado ${index + 1}`,
          party: null,
          uf: null,
        },
      })),
    };
    const service = new CompatibilityService(createProvider(repeatedProfiles));
    const request = {
      source: 'CAMARA' as const,
      preferences: [{ themeCode: 56, weight: 5 }],
    };

    const defaultResponse = await service.rank(request);
    const limitedResponse = await service.rank({ ...request, limit: 2 });

    expect(defaultResponse.results).toHaveLength(5);
    expect(defaultResponse.results.map(({ position }) => position)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(limitedResponse.results).toHaveLength(2);
  });

  it.each([
    { source: 'SENADO', preferences: [{ themeCode: 46, weight: 5 }] },
    { source: 'CAMARA', preferences: [] },
    {
      source: 'CAMARA',
      preferences: [
        { themeCode: 46, weight: 5 },
        { themeCode: 46, weight: 3 },
      ],
    },
    { source: 'CAMARA', preferences: [{ themeCode: 999, weight: 5 }] },
    { source: 'CAMARA', preferences: [{ themeCode: 46, weight: 0 }] },
    { source: 'CAMARA', preferences: [{ themeCode: 46, weight: 6 }] },
    { source: 'CAMARA', preferences: [{ themeCode: 46, weight: 1.5 }] },
    {
      source: 'CAMARA',
      preferences: [34, 35, 37, 39, 40, 41, 42, 43, 44, 46, 48].map(
        (themeCode) => ({
          themeCode,
          weight: 1,
        }),
      ),
    },
    { source: 'CAMARA', preferences: [{ themeCode: 46, weight: 5 }], limit: 0 },
    {
      source: 'CAMARA',
      preferences: [{ themeCode: 46, weight: 5 }],
      limit: 21,
    },
  ])('rejeita preferências inválidas %#', async (request) => {
    const service = new CompatibilityService(createProvider());

    await expect(
      service.rank(request as Parameters<typeof service.rank>[0]),
    ).rejects.toBeInstanceOf(CompatibilityInvalidPreferencesError);
  });
});
