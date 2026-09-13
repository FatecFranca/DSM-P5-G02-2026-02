import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProfileRepository } from '../../../src/modules/compatibilidade/theme-profile.repository.js';
import type { ParlamentarPersistence } from '../../../src/modules/parlamentares/parlamentar.model.js';
import type { ProposicaoPersistence } from '../../../src/modules/proposicoes/proposicao.model.js';

describe('ThemeProfileRepository', () => {
  it('agrega todos os perfis em um pipeline por source e período', async () => {
    const aggregateResult = {
      summaries: [
        {
          parliamentarianId: 123,
          documentsAnalyzed: 2,
          documentsWithThemes: 1,
        },
      ],
      themes: [{ parliamentarianId: 123, themeCode: 46, documentCount: 1 }],
      evidence: [],
    };
    const exec = vi.fn(() => Promise.resolve([aggregateResult]));
    const aggregate = vi.fn((pipeline: object[]) => {
      void pipeline;
      return { exec };
    });
    const repository = new ThemeProfileRepository(
      { aggregate } as unknown as Model<ProposicaoPersistence>,
      {} as Model<ParlamentarPersistence>,
    );

    await expect(
      repository.aggregateProfiles({
        startYear: 2023,
        endYear: 2025,
      }),
    ).resolves.toEqual(aggregateResult);

    const pipeline = aggregate.mock.calls[0]?.[0];
    expect(pipeline?.[0]).toEqual({
      $match: { source: 'CAMARA', ano: { $gte: 2023, $lte: 2025 } },
    });
    expect(pipeline).toContainEqual({ $unwind: '$parliamentarianIds' });
    expect(pipeline?.some((stage) => '$facet' in stage)).toBe(true);
  });

  it('lista deputados uma vez e mapeia somente os campos públicos', async () => {
    const documents = [
      {
        externalId: 123,
        nome: 'Deputada Exemplo',
        partido: 'ABC',
        uf: 'SP',
        email: 'nao-retornar@example.test',
      },
    ];
    const exec = vi.fn(() => Promise.resolve(documents));
    const lean = vi.fn(() => ({ exec }));
    const sort = vi.fn(() => ({ lean }));
    const find = vi.fn(() => ({ sort }));
    const repository = new ThemeProfileRepository(
      {} as Model<ProposicaoPersistence>,
      { find } as unknown as Model<ParlamentarPersistence>,
    );

    await expect(repository.listDeputies()).resolves.toEqual([
      { id: 123, name: 'Deputada Exemplo', party: 'ABC', uf: 'SP' },
    ]);
    expect(find).toHaveBeenCalledWith({ source: 'CAMARA' });
  });

  it('limita a busca de evidências aos parlamentares já ranqueados', async () => {
    const exec = vi.fn(() =>
      Promise.resolve([
        {
          parliamentarianId: 123,
          themeCode: 46,
          documents: [{ proposalId: 900, title: 'Educação pública.' }],
        },
      ]),
    );
    const aggregate = vi.fn((pipeline: object[]) => {
      void pipeline;
      return { exec };
    });
    const repository = new ThemeProfileRepository(
      { aggregate } as unknown as Model<ProposicaoPersistence>,
      {} as Model<ParlamentarPersistence>,
    );

    const evidence = await repository.aggregateEvidence({
      startYear: 2023,
      endYear: 2025,
      parliamentarianIds: [123, 456],
      themeCodes: [46, 56],
    });

    expect(evidence).toEqual([
      {
        parliamentarianId: 123,
        themeCode: 46,
        documents: [{ proposalId: 900, title: 'Educação pública.' }],
      },
    ]);
    expect(aggregate.mock.calls[0]?.[0]?.[0]).toEqual({
      $match: {
        source: 'CAMARA',
        ano: { $gte: 2023, $lte: 2025 },
        'autores.parlamentarExternalId': { $in: [123, 456] },
        'temasOficiais.codTema': { $in: [46, 56] },
      },
    });
  });

  it('usa ML somente quando não há tema oficial no modo enriquecido', async () => {
    const exec = vi.fn(() =>
      Promise.resolve([{ summaries: [], themes: [], evidence: [] }]),
    );
    const aggregate = vi.fn((pipeline: object[]) => {
      void pipeline;
      return { exec };
    });
    const repository = new ThemeProfileRepository(
      { aggregate } as unknown as Model<ProposicaoPersistence>,
      {} as Model<ParlamentarPersistence>,
    );

    await repository.aggregateProfiles({
      startYear: 2023,
      endYear: 2025,
      themeSource: 'enriched',
    });

    const pipeline = JSON.stringify(aggregate.mock.calls[0]?.[0]);
    expect(pipeline).toContain('mlClassification.labels');
    expect(pipeline).toContain('documentsWithOfficialThemes');
    expect(pipeline).toContain('documentsWithMLThemes');
  });

  it('informa todas as versões ML efetivamente incluídas no perfil enriquecido', async () => {
    const exec = vi.fn(() =>
      Promise.resolve([
        {
          summaries: [
            {
              parliamentarianId: 123,
              documentsAnalyzed: 1,
              documentsWithThemes: 1,
              modelVersions: ['experimental-2', 'experimental-1'],
            },
          ],
          themes: [],
          evidence: [],
        },
      ]),
    );
    const aggregate = vi.fn(() => ({ exec }));
    const repository = new ThemeProfileRepository(
      { aggregate } as unknown as Model<ProposicaoPersistence>,
      {} as Model<ParlamentarPersistence>,
    );

    await expect(
      repository.aggregateProfiles({
        startYear: 2023,
        endYear: 2025,
        themeSource: 'enriched',
      }),
    ).resolves.toMatchObject({
      summaries: [
        {
          parliamentarianId: 123,
          modelVersions: ['experimental-2', 'experimental-1'],
        },
      ],
    });
    const pipeline = JSON.stringify(aggregate.mock.calls[0]?.[0]);
    expect(pipeline).toContain('mlClassification.modelVersion');
    expect(pipeline).toContain('modelVersions');
  });
});
