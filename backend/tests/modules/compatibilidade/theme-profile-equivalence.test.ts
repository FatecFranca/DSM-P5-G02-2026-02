import { isDeepStrictEqual } from 'node:util';

import { describe, expect, it } from 'vitest';

import { CompatibilityService } from '../../../src/modules/compatibilidade/compatibility.service.js';
import { MaterializedThemeProfileService } from '../../../src/modules/compatibilidade/materialized-theme-profile.service.js';
import type {
  MaterializedThemeProfileInput,
  MaterializedThemeProfilePersistence,
  MaterializedThemeProfileRepositoryContract,
  MaterializedThemeProfileScope,
} from '../../../src/modules/compatibilidade/materialized-theme-profile.types.js';
import { ThemeProfileMaterializationService } from '../../../src/modules/compatibilidade/theme-profile-materialization.service.js';
import { ThemeProfileService } from '../../../src/modules/compatibilidade/theme-profile.service.js';
import type {
  ProfileAggregation,
  ThemeProfileRepositoryContract,
  ThemeSourceMode,
} from '../../../src/modules/compatibilidade/theme-profile.types.js';

const deputies = [
  { id: 1, name: 'A', party: null, uf: 'SP' },
  { id: 2, name: 'B', party: null, uf: 'RJ' },
];

const aggregations: Record<ThemeSourceMode, ProfileAggregation> = {
  official: {
    summaries: [
      {
        parliamentarianId: 1,
        documentsAnalyzed: 2,
        documentsWithThemes: 1,
        documentsWithOfficialThemes: 1,
        documentsWithMLThemes: 1,
        documentsWithEnrichedThemes: 2,
      },
      {
        parliamentarianId: 2,
        documentsAnalyzed: 1,
        documentsWithThemes: 1,
        documentsWithOfficialThemes: 1,
        documentsWithMLThemes: 0,
        documentsWithEnrichedThemes: 1,
      },
    ],
    themes: [
      { parliamentarianId: 1, themeCode: 46, documentCount: 1 },
      { parliamentarianId: 2, themeCode: 56, documentCount: 1 },
    ],
    evidence: [],
    modelVersions: [],
  },
  enriched: {
    summaries: [
      {
        parliamentarianId: 1,
        documentsAnalyzed: 2,
        documentsWithThemes: 2,
        documentsWithOfficialThemes: 1,
        documentsWithMLThemes: 1,
        documentsWithEnrichedThemes: 2,
      },
      {
        parliamentarianId: 2,
        documentsAnalyzed: 1,
        documentsWithThemes: 1,
        documentsWithOfficialThemes: 1,
        documentsWithMLThemes: 0,
        documentsWithEnrichedThemes: 1,
      },
    ],
    themes: [
      { parliamentarianId: 1, themeCode: 46, documentCount: 1 },
      { parliamentarianId: 1, themeCode: 56, documentCount: 1 },
      { parliamentarianId: 2, themeCode: 56, documentCount: 1 },
    ],
    evidence: [],
    modelVersions: ['experimental-1'],
  },
};

class InMemoryProfiles implements MaterializedThemeProfileRepositoryContract {
  records: MaterializedThemeProfilePersistence[] = [];

  findProfile(scope: MaterializedThemeProfileScope, id: number) {
    return Promise.resolve(
      this.records.find(
        (record) =>
          record.parliamentarianExternalId === id &&
          record.themeSource === scope.themeSource,
      ) ?? null,
    );
  }

  listProfiles(scope: MaterializedThemeProfileScope) {
    return Promise.resolve(
      this.records.filter((record) => record.themeSource === scope.themeSource),
    );
  }

  countProfiles(scope: MaterializedThemeProfileScope) {
    return Promise.resolve(
      this.records.filter((record) => record.themeSource === scope.themeSource)
        .length,
    );
  }

  replaceScope(
    scope: MaterializedThemeProfileScope,
    profiles: MaterializedThemeProfileInput[],
    options: { generatedAt: Date },
  ) {
    this.records = [
      ...this.records.filter(
        (record) => record.themeSource !== scope.themeSource,
      ),
      ...profiles.map((profile) => ({
        ...profile,
        generatedAt: options.generatedAt,
      })),
    ];
    return Promise.resolve({
      inserted: profiles.length,
      updated: 0,
      unchanged: 0,
      deleted: 0,
    });
  }
}

describe('equivalência de perfis materializados', () => {
  it.each(['official', 'enriched'] as const)(
    'preserva profundamente perfil e ranking %s',
    async (themeSource) => {
      const sourceRepository: ThemeProfileRepositoryContract = {
        findDeputy: (id) =>
          Promise.resolve(deputies.find((deputy) => deputy.id === id) ?? null),
        listDeputies: () => Promise.resolve(deputies),
        aggregateProfiles: (query) =>
          Promise.resolve(aggregations[query.themeSource ?? 'official']),
        aggregateEvidence: () => Promise.resolve([]),
      };
      const stored = new InMemoryProfiles();
      const source = new ThemeProfileService(sourceRepository);
      await new ThemeProfileMaterializationService({
        sourceRepository,
        materializedRepository: stored,
      }).run({
        source: 'CAMARA',
        startYear: 2023,
        endYear: 2025,
        themeSource,
        dryRun: false,
        batchSize: 100,
      });
      const materialized = new MaterializedThemeProfileService({
        sourceRepository,
        sourceProvider: source,
        sourceProfileService: source,
        materializedRepository: stored,
      });
      const period = { startYear: 2023, endYear: 2025 };

      const sourceProfile = await source.getProfile(1, period, themeSource);
      const materializedProfile = await materialized.getProfile(
        1,
        period,
        themeSource,
      );
      expect(isDeepStrictEqual(materializedProfile, sourceProfile)).toBe(true);

      const request = {
        source: 'CAMARA' as const,
        period,
        themeSource,
        preferences: [
          { themeCode: 46, weight: 5 },
          { themeCode: 56, weight: 4 },
        ],
        limit: 2,
      };
      const sourceRanking = await new CompatibilityService(source).rank(
        request,
      );
      const materializedRanking = await new CompatibilityService(
        materialized,
      ).rank(request);
      expect(isDeepStrictEqual(materializedRanking, sourceRanking)).toBe(true);
    },
  );
});
