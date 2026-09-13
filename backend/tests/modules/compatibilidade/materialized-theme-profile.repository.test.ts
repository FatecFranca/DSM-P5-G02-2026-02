import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { MaterializedThemeProfileRepository } from '../../../src/modules/compatibilidade/materialized-theme-profile.repository.js';
import type {
  MaterializedThemeProfileInput,
  MaterializedThemeProfilePersistence,
} from '../../../src/modules/compatibilidade/materialized-theme-profile.types.js';

const scope = {
  source: 'CAMARA' as const,
  startYear: 2023,
  endYear: 2025,
  themeSource: 'official' as const,
};

function profile(
  parliamentarianExternalId: number,
  dataVersion: string,
): MaterializedThemeProfileInput {
  return {
    source: 'CAMARA',
    parliamentarianExternalId,
    periodStartYear: 2023,
    periodEndYear: 2025,
    themeSource: 'official',
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
    dataVersion,
    modelVersions: [],
  };
}

function createModel(existing: object[]) {
  const exec = vi.fn(() => Promise.resolve(existing));
  const lean = vi.fn(() => ({ exec }));
  const sort = vi.fn(() => ({ lean }));
  const find = vi.fn(() => ({ sort }));
  const bulkWrite = vi.fn(() =>
    Promise.resolve({ upsertedCount: 1, modifiedCount: 1, deletedCount: 0 }),
  );
  return {
    model: {
      find,
      bulkWrite,
    } as unknown as Model<MaterializedThemeProfilePersistence>,
    find,
    bulkWrite,
  };
}

describe('MaterializedThemeProfileRepository', () => {
  it('isola find, list e count por período e themeSource', async () => {
    const findOneExec = vi.fn(() => Promise.resolve(profile(1, 'one')));
    const findOneLean = vi.fn(() => ({ exec: findOneExec }));
    const findOne = vi.fn(() => ({ lean: findOneLean }));
    const findExec = vi.fn(() => Promise.resolve([profile(1, 'one')]));
    const findLean = vi.fn(() => ({ exec: findExec }));
    const sort = vi.fn(() => ({ lean: findLean }));
    const find = vi.fn(() => ({ sort }));
    const countExec = vi.fn(() => Promise.resolve(1));
    const countDocuments = vi.fn(() => ({ exec: countExec }));
    const repository = new MaterializedThemeProfileRepository({
      findOne,
      find,
      countDocuments,
    } as unknown as Model<MaterializedThemeProfilePersistence>);
    const enriched2024 = {
      source: 'CAMARA' as const,
      startYear: 2024,
      endYear: 2024,
      themeSource: 'enriched' as const,
    };

    await repository.findProfile(enriched2024, 1);
    await repository.listProfiles(enriched2024);
    await repository.countProfiles(enriched2024);

    const expectedScope = {
      source: 'CAMARA',
      periodStartYear: 2024,
      periodEndYear: 2024,
      themeSource: 'enriched',
    };
    expect(findOne).toHaveBeenCalledWith({
      ...expectedScope,
      parliamentarianExternalId: 1,
    });
    expect(find).toHaveBeenCalledWith(expectedScope);
    expect(countDocuments).toHaveBeenCalledWith(expectedScope);
  });

  it('classifica insert, update e unchanged por dataVersion no dry-run sem escrever', async () => {
    const { model, find, bulkWrite } = createModel([
      profile(1, 'same'),
      profile(2, 'old'),
    ]);
    const repository = new MaterializedThemeProfileRepository(model);

    await expect(
      repository.replaceScope(
        scope,
        [profile(1, 'same'), profile(2, 'new'), profile(3, 'new')],
        {
          dryRun: true,
          batchSize: 100,
          generatedAt: new Date('2026-09-11T12:00:00.000Z'),
        },
      ),
    ).resolves.toEqual({ inserted: 1, updated: 1, unchanged: 1, deleted: 0 });
    expect(find).toHaveBeenCalledWith({
      source: 'CAMARA',
      periodStartYear: 2023,
      periodEndYear: 2025,
      themeSource: 'official',
    });
    expect(bulkWrite).not.toHaveBeenCalled();
  });

  it('faz bulk upsert somente de perfis semanticamente alterados', async () => {
    const { model, bulkWrite } = createModel([
      profile(1, 'same'),
      profile(2, 'old'),
    ]);
    const repository = new MaterializedThemeProfileRepository(model);
    const generatedAt = new Date('2026-09-11T12:00:00.000Z');

    const result = await repository.replaceScope(
      scope,
      [profile(1, 'same'), profile(2, 'new'), profile(3, 'new')],
      { dryRun: false, batchSize: 100, generatedAt },
    );

    expect(result).toEqual({
      inserted: 1,
      updated: 1,
      unchanged: 1,
      deleted: 0,
    });
    const operations = bulkWrite.mock.calls[0]?.[0];
    expect(operations).toHaveLength(2);
    expect(operations).toContainEqual({
      updateOne: {
        filter: {
          source: 'CAMARA',
          parliamentarianExternalId: 2,
          periodStartYear: 2023,
          periodEndYear: 2025,
          themeSource: 'official',
        },
        update: { $set: { ...profile(2, 'new'), generatedAt } },
        upsert: true,
      },
    });
  });

  it('remove seletivamente perfis antigos que não pertencem mais ao escopo gerado', async () => {
    const { model, bulkWrite } = createModel([
      profile(1, 'same'),
      profile(99, 'stale'),
    ]);
    const repository = new MaterializedThemeProfileRepository(model);

    await expect(
      repository.replaceScope(scope, [profile(1, 'same')], {
        dryRun: false,
        batchSize: 100,
        generatedAt: new Date('2026-09-11T12:00:00.000Z'),
      }),
    ).resolves.toEqual({ inserted: 0, updated: 0, unchanged: 1, deleted: 1 });
    expect(bulkWrite.mock.calls[0]?.[0]).toEqual([
      {
        deleteOne: {
          filter: {
            source: 'CAMARA',
            parliamentarianExternalId: 99,
            periodStartYear: 2023,
            periodEndYear: 2025,
            themeSource: 'official',
          },
        },
      },
    ]);
  });
});
