import { describe, expect, it } from 'vitest';

import { CompatibilityService } from '../../../src/modules/compatibilidade/compatibility.service.js';
import { ThemeProfilesNotReadyError } from '../../../src/modules/compatibilidade/compatibility.errors.js';
import { MaterializedThemeProfileService } from '../../../src/modules/compatibilidade/materialized-theme-profile.service.js';
import type {
  MaterializedThemeProfilePersistence,
  MaterializedThemeProfileRepositoryContract,
} from '../../../src/modules/compatibilidade/materialized-theme-profile.types.js';
import type {
  ThemeProfileRepositoryContract,
  ThemeProfilesProvider,
} from '../../../src/modules/compatibilidade/theme-profile.types.js';

function record(
  parliamentarianExternalId: number,
  code: number,
  share: number,
): MaterializedThemeProfilePersistence {
  return {
    source: 'CAMARA',
    parliamentarianExternalId,
    periodStartYear: 2023,
    periodEndYear: 2025,
    themeSource: 'official',
    documentsAnalyzed: 10,
    documentsWithThemes: 10,
    documentsWithOfficialThemes: 10,
    documentsWithMLThemes: 0,
    documentsWithoutThemes: 0,
    coverage: 1,
    officialCoverage: 1,
    enrichedCoverage: 1,
    totalThemeOccurrences: 10,
    themes: [
      {
        code,
        name: code === 46 ? 'Educação' : 'Saúde',
        documentCount: 10,
        share,
      },
    ],
    generatedAt: new Date('2026-09-11T12:00:00.000Z'),
    dataVersion: `profile-${parliamentarianExternalId}`,
    modelVersions: [],
  };
}

function dependencies(records: MaterializedThemeProfilePersistence[]) {
  const deputies = [
    { id: 1, name: 'A', party: null, uf: 'SP' },
    { id: 2, name: 'B', party: null, uf: 'RJ' },
  ];
  const sourceRepository: ThemeProfileRepositoryContract = {
    findDeputy: (id) =>
      Promise.resolve(deputies.find((item) => item.id === id) ?? null),
    listDeputies: () => Promise.resolve(deputies),
    aggregateProfiles: () =>
      Promise.resolve({ summaries: [], themes: [], evidence: [] }),
    aggregateEvidence: () => Promise.resolve([]),
  };
  const materializedRepository: MaterializedThemeProfileRepositoryContract = {
    findProfile: (_scope, id) =>
      Promise.resolve(
        records.find((item) => item.parliamentarianExternalId === id) ?? null,
      ),
    listProfiles: () => Promise.resolve(records),
    countProfiles: () => Promise.resolve(records.length),
    replaceScope: () =>
      Promise.resolve({ inserted: 0, updated: 0, unchanged: 0, deleted: 0 }),
  };
  let fallbacks = 0;
  const sourceProvider: ThemeProfilesProvider = {
    getComparableProfiles: () => {
      throw new Error('não deve recalcular todos os perfis');
    },
    getEvidence: () => Promise.resolve([]),
  };
  const sourceProfileService = {
    getProfile: () => {
      fallbacks += 1;
      return Promise.resolve({
        parliamentarian: deputies[0],
        source: 'CAMARA' as const,
        period: { startYear: 2023, endYear: 2025 },
        themeSource: 'official' as const,
        documentsAnalyzed: 0,
        documentsWithThemes: 0,
        documentsWithOfficialThemes: 0,
        documentsWithMLThemes: 0,
        documentsWithoutThemes: 0,
        coverage: 0,
        officialCoverage: 0,
        enrichedCoverage: 0,
        themes: [],
      });
    },
  };
  return {
    service: new MaterializedThemeProfileService({
      sourceRepository,
      sourceProvider,
      sourceProfileService,
      materializedRepository,
    }),
    getFallbacks: () => fallbacks,
  };
}

describe('MaterializedThemeProfileService', () => {
  it('lê perfil individual materializado sem executar fallback', async () => {
    const { service, getFallbacks } = dependencies([
      record(1, 46, 1),
      record(2, 56, 1),
    ]);

    await expect(service.getProfile(1)).resolves.toMatchObject({
      parliamentarian: { id: 1 },
      themeSource: 'official',
      themes: [{ code: 46, share: 1 }],
    });
    expect(getFallbacks()).toBe(0);
  });

  it('usa fallback controlado apenas no perfil individual ausente', async () => {
    const { service, getFallbacks } = dependencies([]);
    await expect(service.getProfile(1)).resolves.toMatchObject({ themes: [] });
    expect(getFallbacks()).toBe(1);
  });

  it('recusa ranking quando o escopo materializado está incompleto', async () => {
    const { service } = dependencies([record(1, 46, 1)]);
    await expect(service.getComparableProfiles()).rejects.toBeInstanceOf(
      ThemeProfilesNotReadyError,
    );
  });

  it('mantém exatamente o ranking cosine usando vetores materializados', async () => {
    const { service } = dependencies([record(1, 46, 1), record(2, 56, 1)]);
    const result = await new CompatibilityService(service).rank({
      source: 'CAMARA',
      preferences: [
        { themeCode: 46, weight: 5 },
        { themeCode: 56, weight: 4 },
      ],
      limit: 2,
    });

    expect(result.results.map((item) => item.parliamentarian.id)).toEqual([
      1, 2,
    ]);
    expect(result.results.map((item) => item.compatibility)).toEqual([
      5 / Math.sqrt(41),
      4 / Math.sqrt(41),
    ]);
  });
});
