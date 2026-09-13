import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { ParticipacaoOrgaoPersistence } from '../../../src/modules/indicadores/indicador.model.js';
import type { VotoPersistence } from '../../../src/modules/indicadores/indicador.model.js';
import { ParlamentarIndicadoresRepository } from '../../../src/modules/indicadores/parlamentar-indicadores.repository.js';

const query = {
  source: 'CAMARA' as const,
  parlamentarExternalId: 204_379,
  inicio: new Date('2026-06-01T00:00:00.000Z'),
  fimExclusivo: new Date('2026-07-01T00:00:00.000Z'),
  page: 1,
  limit: 5,
};

describe('ParlamentarIndicadoresRepository', () => {
  it('lista votos unidos às votações e paginados', async () => {
    const aggregate = vi.fn(() => ({
      exec: () =>
        Promise.resolve([
          {
            votacaoExternalId: '2633410-8',
            data: new Date('2026-06-17T00:00:00.000Z'),
            voto: 'Sim',
            descricao: 'Descrição oficial',
            resultado: '1',
            casa: 'CAMARA',
            proposicaoExternalId: 2_633_410,
          },
        ]),
    }));
    const countDocuments = vi.fn(() => ({ exec: () => Promise.resolve(1) }));
    const repository = new ParlamentarIndicadoresRepository(
      { aggregate, countDocuments } as unknown as Model<VotoPersistence>,
      {} as Model<ParticipacaoOrgaoPersistence>,
    );

    await expect(repository.listVotacoes(query)).resolves.toMatchObject({
      total: 1,
      data: [{ voto: 'Sim', votacaoExternalId: '2633410-8' }],
    });
    expect(countDocuments).toHaveBeenCalledWith({
      source: 'CAMARA',
      parlamentarExternalId: 204_379,
      data: { $gte: query.inicio, $lt: query.fimExclusivo },
    });
    expect(aggregate.mock.calls[0]?.[0]?.[0]).toEqual({
      $match: {
        source: 'CAMARA',
        parlamentarExternalId: 204_379,
        data: { $gte: query.inicio, $lt: query.fimExclusivo },
      },
    });
  });

  it('lista participações em órgãos que sobrepõem o período', async () => {
    const exec = vi.fn(() =>
      Promise.resolve([
        {
          orgaoExternalId: 2003,
          sigla: 'CCJC',
          nome: 'Comissão de Constituição e Justiça e de Cidadania',
          casa: 'CAMARA',
          funcao: 'Titular',
          inicio: new Date('2026-03-05T00:00:00.000Z'),
          fim: null,
        },
      ]),
    );
    const limit = vi.fn(() => ({ lean: () => ({ exec }) }));
    const skip = vi.fn(() => ({ limit }));
    const sort = vi.fn(() => ({ skip }));
    const find = vi.fn(() => ({ sort }));
    const countDocuments = vi.fn(() => ({ exec: () => Promise.resolve(1) }));
    const repository = new ParlamentarIndicadoresRepository(
      {} as Model<VotoPersistence>,
      {
        find,
        countDocuments,
      } as unknown as Model<ParticipacaoOrgaoPersistence>,
    );

    await expect(repository.listOrgaos(query)).resolves.toMatchObject({
      total: 1,
      data: [{ orgaoExternalId: 2003 }],
    });
    expect(find).toHaveBeenCalledWith({
      source: 'CAMARA',
      parlamentarExternalId: 204_379,
      inicio: { $ne: null, $lt: query.fimExclusivo },
      $or: [{ fim: null }, { fim: { $gte: query.inicio } }],
    });
    expect(sort).toHaveBeenCalledWith({ inicio: -1, orgaoExternalId: 1 });
    expect(skip).toHaveBeenCalledWith(0);
    expect(limit).toHaveBeenCalledWith(5);
  });
});
