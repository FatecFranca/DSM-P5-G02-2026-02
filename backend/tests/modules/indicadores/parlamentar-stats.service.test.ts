import { describe, expect, it } from 'vitest';

import { DeputadoNotFoundError } from '../../../src/integrations/camara/camara.errors.js';
import { SenadorNotFoundError } from '../../../src/integrations/senado/senado.errors.js';
import { EstatisticaInvalidPeriodError } from '../../../src/modules/indicadores/indicador.errors.js';
import { ParlamentarStatsService } from '../../../src/modules/indicadores/parlamentar-stats.service.js';
import type { ParlamentarStatsRepositoryContract } from '../../../src/modules/indicadores/parlamentar-stats.types.js';
import type { ParlamentarRepositoryContract } from '../../../src/modules/parlamentares/parlamentar.types.js';

function parlamentares(source: 'CAMARA' | 'SENADO' | null) {
  const repository: ParlamentarRepositoryContract = {
    upsertMany: () =>
      Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
    list: () => Promise.resolve({ data: [], total: 0 }),
    findByExternalId: ({ source: requestedSource, externalId }) =>
      Promise.resolve(
        source === requestedSource
          ? {
              source,
              casa: source,
              externalId,
              nome: 'Parlamentar Fictício',
              nomeCivil: null,
              partido: null,
              uf: null,
              fotoUrl: null,
              email: null,
              situacao: null,
              legislatura: null,
              fetchedAt: new Date(),
            }
          : null,
      ),
  };
  return repository;
}

const statsRepository: ParlamentarStatsRepositoryContract = {
  getStats: () =>
    Promise.resolve({
      proposicoes: 3,
      votacoes: 4,
      comissoesOrgaos: 2,
      temas: [
        { codTema: 40, tema: 'Educação', quantidade: 2 },
        { codTema: 62, tema: 'Ciência e Tecnologia', quantidade: 1 },
      ],
    }),
};

describe('ParlamentarStatsService', () => {
  it.each([
    ['CAMARA', 204_379],
    ['SENADO', 5672],
  ] as const)(
    'calcula estatísticas objetivas para %s com período explícito',
    async (source, id) => {
      let received: unknown;
      const repository: ParlamentarStatsRepositoryContract = {
        getStats: (query) => {
          received = query;
          return statsRepository.getStats(query);
        },
      };
      const service = new ParlamentarStatsService(
        repository,
        parlamentares(source),
      );

      const result = await service.getStats(source, id, {
        dataInicio: '2026-06-01',
        dataFim: '2026-06-30',
      });

      expect(received).toEqual({
        source,
        parlamentarExternalId: id,
        inicio: new Date('2026-06-01T00:00:00.000Z'),
        fimExclusivo: new Date('2026-07-01T00:00:00.000Z'),
      });
      expect(result).toEqual({
        parlamentar: { externalId: id, source },
        periodo: { inicio: '2026-06-01', fim: '2026-06-30' },
        estatisticas: {
          proposicoes: 3,
          votacoes: 4,
          comissoesOrgaos: 2,
          temasDistintos: 2,
        },
        temas: [
          { codTema: 40, tema: 'Educação', quantidade: 2 },
          { codTema: 62, tema: 'Ciência e Tecnologia', quantidade: 1 },
        ],
      });
    },
  );

  it.each([
    ['CAMARA', DeputadoNotFoundError],
    ['SENADO', SenadorNotFoundError],
  ] as const)(
    'rejeita parlamentar ausente de %s',
    async (source, ErrorType) => {
      const service = new ParlamentarStatsService(
        statsRepository,
        parlamentares(null),
      );

      await expect(
        service.getStats(source, 999_999, {
          dataInicio: '2026-06-01',
          dataFim: '2026-06-30',
        }),
      ).rejects.toBeInstanceOf(ErrorType);
    },
  );

  it.each([
    { dataInicio: 'inválida', dataFim: '2026-06-30' },
    { dataInicio: '2026-99-99', dataFim: '2026-06-30' },
    { dataInicio: '2026-07-01', dataFim: '2026-06-30' },
  ])('rejeita período inválido %#', async (periodo) => {
    const service = new ParlamentarStatsService(
      statsRepository,
      parlamentares('CAMARA'),
    );

    await expect(
      service.getStats('CAMARA', 204_379, periodo),
    ).rejects.toBeInstanceOf(EstatisticaInvalidPeriodError);
  });
});
