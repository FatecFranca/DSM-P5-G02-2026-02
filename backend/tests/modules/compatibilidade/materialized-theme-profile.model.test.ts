import { describe, expect, it } from 'vitest';

import { MaterializedThemeProfileModel } from '../../../src/modules/compatibilidade/materialized-theme-profile.model.js';

describe('MaterializedThemeProfileModel', () => {
  it('usa uma collection e identidade única por source, deputado, período e modo', () => {
    expect(MaterializedThemeProfileModel.collection.collectionName).toBe(
      'parliamentarian_theme_profiles',
    );
    expect(MaterializedThemeProfileModel.schema.indexes()).toContainEqual([
      {
        source: 1,
        parliamentarianExternalId: 1,
        periodStartYear: 1,
        periodEndYear: 1,
        themeSource: 1,
      },
      { unique: true },
    ]);
  });

  it('aceita perfis official e enriched separados sem decisionScore agregado', async () => {
    const common = {
      source: 'CAMARA',
      parliamentarianExternalId: 123,
      periodStartYear: 2023,
      periodEndYear: 2025,
      documentsAnalyzed: 2,
      documentsWithThemes: 1,
      documentsWithOfficialThemes: 1,
      documentsWithMLThemes: 0,
      documentsWithoutThemes: 1,
      coverage: 0.5,
      officialCoverage: 0.5,
      enrichedCoverage: 0.5,
      totalThemeOccurrences: 1,
      themes: [{ code: 46, name: 'Educação', documentCount: 1, share: 1 }],
      generatedAt: new Date('2026-09-11T12:00:00.000Z'),
      dataVersion: 'version-1',
      modelVersions: [],
    };
    const official = new MaterializedThemeProfileModel({
      ...common,
      themeSource: 'official',
    });
    const enriched = new MaterializedThemeProfileModel({
      ...common,
      themeSource: 'enriched',
      modelVersion: 'experimental-1',
      modelVersions: ['experimental-1'],
    });

    await expect(official.validate()).resolves.toBeUndefined();
    await expect(enriched.validate()).resolves.toBeUndefined();
    expect(official.toObject()).not.toHaveProperty('decisionScore');
    expect(enriched.toObject()).not.toHaveProperty('decisionScore');
  });
});
