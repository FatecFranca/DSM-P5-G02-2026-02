import { describe, expect, it } from 'vitest';

import { DeputadoNotFoundError } from '../../../src/integrations/camara/camara.errors.js';
import { ThemeProfileInvalidPeriodError } from '../../../src/modules/compatibilidade/compatibility.errors.js';
import { ThemeProfileService } from '../../../src/modules/compatibilidade/theme-profile.service.js';
import type {
  ProfileAggregation,
  ThemeProfileRepositoryContract,
} from '../../../src/modules/compatibilidade/theme-profile.types.js';

const deputy = {
  id: 123,
  name: 'Deputada Exemplo',
  party: 'ABC',
  uf: 'SP',
};

function createRepository(
  aggregation: ProfileAggregation,
): ThemeProfileRepositoryContract {
  return {
    findDeputy: (id) => Promise.resolve(id === deputy.id ? deputy : null),
    listDeputies: () => Promise.resolve([deputy]),
    aggregateProfiles: () => Promise.resolve(aggregation),
    aggregateEvidence: () => Promise.resolve([]),
  };
}

describe('ThemeProfileService', () => {
  it('separa cobertura oficial e ML no modo enriquecido', async () => {
    let receivedQuery: unknown;
    const repository = createRepository({
      summaries: [
        {
          parliamentarianId: 123,
          documentsAnalyzed: 4,
          documentsWithThemes: 3,
          documentsWithOfficialThemes: 1,
          documentsWithMLThemes: 2,
          documentsWithEnrichedThemes: 3,
        },
      ],
      themes: [{ parliamentarianId: 123, themeCode: 46, documentCount: 3 }],
      evidence: [],
    });
    repository.aggregateProfiles = (query) => {
      receivedQuery = query;
      return Promise.resolve({
        summaries: [
          {
            parliamentarianId: 123,
            documentsAnalyzed: 4,
            documentsWithThemes: 3,
            documentsWithOfficialThemes: 1,
            documentsWithMLThemes: 2,
            documentsWithEnrichedThemes: 3,
          },
        ],
        themes: [{ parliamentarianId: 123, themeCode: 46, documentCount: 3 }],
        evidence: [],
      });
    };

    const profile = await new ThemeProfileService(repository).getProfile(
      123,
      { startYear: 2023, endYear: 2025 },
      'enriched',
    );

    expect(receivedQuery).toEqual({
      startYear: 2023,
      endYear: 2025,
      parliamentarianId: 123,
      themeSource: 'enriched',
    });
    expect(profile).toMatchObject({
      themeSource: 'enriched',
      documentsAnalyzed: 4,
      documentsWithThemes: 3,
      documentsWithOfficialThemes: 1,
      documentsWithMLThemes: 2,
      documentsWithoutThemes: 1,
      coverage: 3 / 4,
      officialCoverage: 1 / 4,
      enrichedCoverage: 3 / 4,
    });
  });

  it('normaliza ocorrências multi-label e ordena por share e código', async () => {
    const service = new ThemeProfileService(
      createRepository({
        summaries: [
          {
            parliamentarianId: 123,
            documentsAnalyzed: 3,
            documentsWithThemes: 2,
          },
        ],
        themes: [
          { parliamentarianId: 123, themeCode: 56, documentCount: 1 },
          { parliamentarianId: 123, themeCode: 46, documentCount: 2 },
          { parliamentarianId: 123, themeCode: 62, documentCount: 1 },
        ],
        evidence: [],
      }),
    );

    const profile = await service.getProfile(123, {
      startYear: 2023,
      endYear: 2025,
    });

    expect(profile).toEqual({
      parliamentarian: deputy,
      source: 'CAMARA',
      period: { startYear: 2023, endYear: 2025 },
      themeSource: 'official',
      documentsAnalyzed: 3,
      documentsWithThemes: 2,
      documentsWithOfficialThemes: 2,
      documentsWithMLThemes: 0,
      documentsWithoutThemes: 1,
      coverage: 2 / 3,
      officialCoverage: 2 / 3,
      enrichedCoverage: 2 / 3,
      themes: [
        { code: 46, name: 'Educação', documentCount: 2, share: 0.5 },
        { code: 56, name: 'Saúde', documentCount: 1, share: 0.25 },
        {
          code: 62,
          name: 'Ciência, Tecnologia e Inovação',
          documentCount: 1,
          share: 0.25,
        },
      ],
    });
    expect(profile.themes.reduce((sum, theme) => sum + theme.share, 0)).toBe(1);
  });

  it('retorna perfil vazio sem dividir por zero', async () => {
    const service = new ThemeProfileService(
      createRepository({ summaries: [], themes: [], evidence: [] }),
    );

    await expect(service.getProfile(123)).resolves.toMatchObject({
      period: { startYear: 2023, endYear: 2025 },
      documentsAnalyzed: 0,
      documentsWithThemes: 0,
      documentsWithoutThemes: 0,
      coverage: 0,
      themes: [],
    });
  });

  it('rejeita período invertido ou fora do intervalo aceito', async () => {
    const service = new ThemeProfileService(
      createRepository({ summaries: [], themes: [], evidence: [] }),
    );

    await expect(
      service.getProfile(123, { startYear: 2025, endYear: 2023 }),
    ).rejects.toBeInstanceOf(ThemeProfileInvalidPeriodError);
    await expect(
      service.getProfile(123, { startYear: 1899, endYear: 2025 }),
    ).rejects.toBeInstanceOf(ThemeProfileInvalidPeriodError);
  });

  it('rejeita deputado inexistente', async () => {
    const service = new ThemeProfileService(
      createRepository({ summaries: [], themes: [], evidence: [] }),
    );

    await expect(service.getProfile(999)).rejects.toBeInstanceOf(
      DeputadoNotFoundError,
    );
  });

  it('exclui da comparação perfis sem ocorrências temáticas', async () => {
    const secondDeputy = {
      id: 456,
      name: 'Deputado Dois',
      party: null,
      uf: null,
    };
    const repository: ThemeProfileRepositoryContract = {
      findDeputy: () => Promise.resolve(deputy),
      listDeputies: () => Promise.resolve([deputy, secondDeputy]),
      aggregateProfiles: () =>
        Promise.resolve({
          summaries: [
            {
              parliamentarianId: 123,
              documentsAnalyzed: 2,
              documentsWithThemes: 1,
            },
            {
              parliamentarianId: 456,
              documentsAnalyzed: 1,
              documentsWithThemes: 0,
            },
          ],
          themes: [{ parliamentarianId: 123, themeCode: 46, documentCount: 1 }],
          evidence: [],
        }),
      aggregateEvidence: () => Promise.resolve([]),
    };
    const service = new ThemeProfileService(repository);

    await expect(service.getComparableProfiles()).resolves.toMatchObject({
      parliamentariansConsidered: 2,
      profilesCompared: 1,
      profilesExcludedWithoutThemes: 1,
      documentsAnalyzed: 3,
      documentsWithThemes: 1,
      coverage: 1 / 3,
      themesObserved: 1,
      profiles: [{ parliamentarian: deputy }],
    });
  });

  it('preserva origem e metadata ML nas evidências', async () => {
    const repository = createRepository({
      summaries: [],
      themes: [],
      evidence: [],
    });
    repository.aggregateEvidence = () =>
      Promise.resolve([
        {
          parliamentarianId: 123,
          themeCode: 46,
          documents: [
            {
              proposalId: 900,
              title: 'Educação pública.',
              themeOrigin: 'ML',
              decisionScore: 1.25,
              modelName: 'linear_svc_balanced',
              modelVersion: 'experimental-1',
            },
          ],
        },
      ]);
    const service = new ThemeProfileService(repository);

    await expect(
      service.getEvidence(
        { startYear: 2023, endYear: 2025 },
        [123],
        [46],
        'enriched',
      ),
    ).resolves.toEqual([
      {
        parliamentarianId: 123,
        proposalId: 900,
        themeCode: 46,
        title: 'Educação pública.',
        source: 'CAMARA',
        themeOrigin: 'ML',
        decisionScore: 1.25,
        modelName: 'linear_svc_balanced',
        modelVersion: 'experimental-1',
      },
    ]);
  });
});
