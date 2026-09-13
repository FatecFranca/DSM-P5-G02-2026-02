import { describe, expect, it } from 'vitest';

import { DeputadoNotFoundError } from '../../../src/integrations/camara/camara.errors.js';
import { EstatisticaInvalidPeriodError } from '../../../src/modules/indicadores/indicador.errors.js';
import { ParlamentarIndicadoresService } from '../../../src/modules/indicadores/parlamentar-indicadores.service.js';
import type { ParlamentarIndicadoresRepositoryContract } from '../../../src/modules/indicadores/parlamentar-indicadores.types.js';
import type { ParlamentarRepositoryContract } from '../../../src/modules/parlamentares/parlamentar.types.js';

const repository: ParlamentarIndicadoresRepositoryContract = {
  listVotacoes: () =>
    Promise.resolve({
      data: [
        {
          votacaoExternalId: '2633410-8',
          data: new Date('2026-06-17T00:00:00.000Z'),
          voto: 'Sim',
          descricao: 'Descrição oficial',
          resultado: '1',
          casa: 'CAMARA',
          proposicaoExternalId: 2_633_410,
        },
      ],
      total: 1,
    }),
  listOrgaos: () =>
    Promise.resolve({
      data: [
        {
          orgaoExternalId: 2003,
          sigla: 'CCJC',
          nome: 'Comissão de Constituição e Justiça e de Cidadania',
          casa: 'CAMARA',
          funcao: 'Titular',
          inicio: new Date('2026-03-05T00:00:00.000Z'),
          fim: null,
        },
      ],
      total: 1,
    }),
};

function parlamentares(found: boolean): ParlamentarRepositoryContract {
  return {
    upsertMany: () =>
      Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
    list: () => Promise.resolve({ data: [], total: 0 }),
    findByExternalId: ({ source, externalId }) =>
      Promise.resolve(
        found
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
}

describe('ParlamentarIndicadoresService', () => {
  it('lista votos oficiais paginados no período', async () => {
    let received: unknown;
    const queryRepository: ParlamentarIndicadoresRepositoryContract = {
      ...repository,
      listVotacoes: (query) => {
        received = query;
        return repository.listVotacoes(query);
      },
    };
    const service = new ParlamentarIndicadoresService(
      queryRepository,
      parlamentares(true),
    );

    const result = await service.listVotacoes('CAMARA', 204_379, {
      dataInicio: '2026-06-01',
      dataFim: '2026-06-30',
      page: 1,
      limit: 20,
    });

    expect(received).toMatchObject({
      source: 'CAMARA',
      parlamentarExternalId: 204_379,
      inicio: new Date('2026-06-01T00:00:00.000Z'),
      fimExclusivo: new Date('2026-07-01T00:00:00.000Z'),
      page: 1,
      limit: 20,
    });
    expect(result.data[0]).toMatchObject({
      voto: 'Sim',
      data: '2026-06-17T00:00:00.000Z',
    });
    expect(result.pagination.total).toBe(1);
  });

  it('lista órgãos preservando função e datas', async () => {
    const service = new ParlamentarIndicadoresService(
      repository,
      parlamentares(true),
    );

    const result = await service.listOrgaos('SENADO', 5672, {
      dataInicio: '2026-06-01',
      dataFim: '2026-06-30',
      page: 1,
      limit: 20,
    });

    expect(result.data[0]).toEqual({
      orgaoExternalId: 2003,
      sigla: 'CCJC',
      nome: 'Comissão de Constituição e Justiça e de Cidadania',
      casa: 'CAMARA',
      funcao: 'Titular',
      inicio: '2026-03-05T00:00:00.000Z',
      fim: null,
    });
  });

  it('rejeita parlamentar ausente antes de consultar indicadores', async () => {
    const service = new ParlamentarIndicadoresService(
      repository,
      parlamentares(false),
    );

    await expect(
      service.listVotacoes('CAMARA', 999_999, {
        dataInicio: '2026-06-01',
        dataFim: '2026-06-30',
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(DeputadoNotFoundError);
  });

  it('rejeita data de calendário inválida sem lançar RangeError', async () => {
    const service = new ParlamentarIndicadoresService(
      repository,
      parlamentares(true),
    );

    await expect(
      service.listVotacoes('CAMARA', 204_379, {
        dataInicio: '2026-99-99',
        dataFim: '2026-06-30',
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(EstatisticaInvalidPeriodError);
  });
});
