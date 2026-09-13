import { describe, expect, it } from 'vitest';

import {
  createThemeProfileDataVersion,
  ThemeProfileMaterializationService,
} from '../../../src/modules/compatibilidade/theme-profile-materialization.service.js';
import { parseThemeProfileMaterializationArgs } from '../../../src/modules/compatibilidade/theme-profile-materialization.cli.js';
import type {
  MaterializedThemeProfileInput,
  MaterializedThemeProfileRepositoryContract,
} from '../../../src/modules/compatibilidade/materialized-theme-profile.types.js';
import type { ThemeProfileRepositoryContract } from '../../../src/modules/compatibilidade/theme-profile.types.js';

const generatedAt = new Date('2026-09-11T12:00:00.000Z');

function sourceRepository(): ThemeProfileRepositoryContract {
  return {
    findDeputy: () => Promise.resolve(null),
    listDeputies: () =>
      Promise.resolve([
        { id: 1, name: 'Com perfil', party: null, uf: 'SP' },
        { id: 2, name: 'Sem perfil', party: null, uf: 'RJ' },
      ]),
    aggregateProfiles: () =>
      Promise.resolve({
        summaries: [
          {
            parliamentarianId: 1,
            documentsAnalyzed: 2,
            documentsWithThemes: 1,
            documentsWithOfficialThemes: 1,
            documentsWithMLThemes: 0,
            documentsWithEnrichedThemes: 1,
            modelVersions: ['experimental-1'],
          },
          {
            parliamentarianId: 2,
            documentsAnalyzed: 1,
            documentsWithThemes: 0,
            documentsWithOfficialThemes: 0,
            documentsWithMLThemes: 0,
            documentsWithEnrichedThemes: 0,
          },
        ],
        themes: [
          { parliamentarianId: 1, themeCode: 46, documentCount: 1 },
          { parliamentarianId: 1, themeCode: 56, documentCount: 1 },
        ],
        evidence: [],
      }),
    aggregateEvidence: () => Promise.resolve([]),
  };
}

class InMemoryMaterializedRepository implements MaterializedThemeProfileRepositoryContract {
  received: MaterializedThemeProfileInput[] = [];

  findProfile() {
    return Promise.resolve(null);
  }

  listProfiles() {
    return Promise.resolve([]);
  }

  countProfiles() {
    return Promise.resolve(0);
  }

  replaceScope(_scope: unknown, profiles: MaterializedThemeProfileInput[]) {
    this.received = profiles;
    return Promise.resolve({
      inserted: 2,
      updated: 0,
      unchanged: 0,
      deleted: 0,
    });
  }
}

describe('ThemeProfileMaterializationService', () => {
  it('materializa em um pipeline perfis com multi-label e também o perfil vazio', async () => {
    const materialized = new InMemoryMaterializedRepository();
    const service = new ThemeProfileMaterializationService({
      sourceRepository: sourceRepository(),
      materializedRepository: materialized,
      clock: () => generatedAt,
    });

    const summary = await service.run({
      source: 'CAMARA',
      startYear: 2023,
      endYear: 2025,
      themeSource: 'official',
      dryRun: false,
      batchSize: 100,
    });

    expect(summary).toMatchObject({
      candidates: 2,
      profiles: 2,
      withoutData: 1,
      inserted: 2,
      updated: 0,
      unchanged: 0,
      deleted: 0,
      status: 'SUCCESS',
    });
    expect(materialized.received[0]).toMatchObject({
      parliamentarianExternalId: 1,
      totalThemeOccurrences: 2,
      themes: [
        { code: 46, documentCount: 1, share: 0.5 },
        { code: 56, documentCount: 1, share: 0.5 },
      ],
      modelVersions: [],
    });
    expect(materialized.received[1]).toMatchObject({
      parliamentarianExternalId: 2,
      documentsAnalyzed: 1,
      themes: [],
      totalThemeOccurrences: 0,
    });
  });

  it('registra uma versão única do modelo enriched sem agregá-la ao score', async () => {
    const materialized = new InMemoryMaterializedRepository();
    await new ThemeProfileMaterializationService({
      sourceRepository: sourceRepository(),
      materializedRepository: materialized,
      clock: () => generatedAt,
    }).run({
      source: 'CAMARA',
      startYear: 2023,
      endYear: 2025,
      themeSource: 'enriched',
      dryRun: true,
      batchSize: 100,
    });

    expect(materialized.received[0]).toMatchObject({
      modelVersion: 'experimental-1',
      modelVersions: ['experimental-1'],
    });
    expect(materialized.received[1]).toMatchObject({ modelVersions: [] });
    expect(materialized.received[1]).not.toHaveProperty('modelVersion');
    expect(materialized.received[0]).not.toHaveProperty('decisionScore');
  });

  it('gera a mesma dataVersion quando apenas generatedAt muda', () => {
    const profile = {
      source: 'CAMARA' as const,
      parliamentarianExternalId: 1,
      periodStartYear: 2023,
      periodEndYear: 2025,
      themeSource: 'official' as const,
      documentsAnalyzed: 1,
      documentsWithThemes: 1,
      documentsWithOfficialThemes: 1,
      documentsWithMLThemes: 0,
      documentsWithoutThemes: 0,
      coverage: 1,
      officialCoverage: 1,
      enrichedCoverage: 1,
      totalThemeOccurrences: 1,
      themes: [{ code: 46, name: 'Educação', documentCount: 1, share: 1 }],
      modelVersions: [],
    };
    expect(createThemeProfileDataVersion(profile)).toBe(
      createThemeProfileDataVersion({ ...profile }),
    );
  });
});

describe('CLI de materialização de perfis', () => {
  it('aceita all, dry-run e batch size sem ampliar o source', () => {
    expect(
      parseThemeProfileMaterializationArgs([
        '--source=CAMARA',
        '--startYear=2023',
        '--endYear=2025',
        '--themeSource=all',
        '--dry-run',
        '--batch-size=200',
      ]),
    ).toEqual({
      source: 'CAMARA',
      startYear: 2023,
      endYear: 2025,
      themeSource: 'all',
      dryRun: true,
      batchSize: 200,
    });
  });
});
