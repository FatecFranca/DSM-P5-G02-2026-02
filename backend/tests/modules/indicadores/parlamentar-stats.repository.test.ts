import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { ParticipacaoOrgaoPersistence } from '../../../src/modules/indicadores/indicador.model.js';
import type { VotoPersistence } from '../../../src/modules/indicadores/indicador.model.js';
import { ParlamentarStatsRepository } from '../../../src/modules/indicadores/parlamentar-stats.repository.js';
import type { ProposicaoPersistence } from '../../../src/modules/proposicoes/proposicao.model.js';

describe('ParlamentarStatsRepository', () => {
  it('agrega dados persistidos por source, parlamentar e período', async () => {
    const propositionCountExec = vi.fn(() => Promise.resolve(3));
    const countDocuments = vi.fn(() => ({ exec: propositionCountExec }));
    const aggregate = vi.fn(() => ({
      exec: () =>
        Promise.resolve([
          { codTema: 40, tema: 'Educação', quantidade: 2 },
          { codTema: 62, tema: 'Ciência e Tecnologia', quantidade: 1 },
        ]),
    }));
    const voteCountDocuments = vi.fn(() => ({
      exec: () => Promise.resolve(4),
    }));
    const distinct = vi.fn(() => ({
      exec: () => Promise.resolve([2003, 6174]),
    }));
    const repository = new ParlamentarStatsRepository(
      { countDocuments, aggregate } as unknown as Model<ProposicaoPersistence>,
      {
        countDocuments: voteCountDocuments,
      } as unknown as Model<VotoPersistence>,
      { distinct } as unknown as Model<ParticipacaoOrgaoPersistence>,
    );
    const inicio = new Date('2026-06-01T00:00:00.000Z');
    const fimExclusivo = new Date('2026-07-01T00:00:00.000Z');

    await expect(
      repository.getStats({
        source: 'CAMARA',
        parlamentarExternalId: 204_379,
        inicio,
        fimExclusivo,
      }),
    ).resolves.toEqual({
      proposicoes: 3,
      votacoes: 4,
      comissoesOrgaos: 2,
      temas: [
        { codTema: 40, tema: 'Educação', quantidade: 2 },
        { codTema: 62, tema: 'Ciência e Tecnologia', quantidade: 1 },
      ],
    });

    const propositionFilter = {
      source: 'CAMARA',
      'autores.parlamentarExternalId': 204_379,
      dataApresentacao: { $gte: inicio, $lt: fimExclusivo },
    };
    expect(countDocuments).toHaveBeenCalledWith(propositionFilter);
    expect(voteCountDocuments).toHaveBeenCalledWith({
      source: 'CAMARA',
      parlamentarExternalId: 204_379,
      data: { $gte: inicio, $lt: fimExclusivo },
    });
    expect(distinct).toHaveBeenCalledWith('orgaoExternalId', {
      source: 'CAMARA',
      parlamentarExternalId: 204_379,
      inicio: { $ne: null, $lt: fimExclusivo },
      $or: [{ fim: null }, { fim: { $gte: inicio } }],
    });
    expect(aggregate).toHaveBeenCalledWith([
      { $match: propositionFilter },
      { $unwind: '$temasOficiais' },
      {
        $group: {
          _id: {
            codTema: '$temasOficiais.codTema',
            tema: '$temasOficiais.tema',
          },
          quantidade: { $sum: 1 },
        },
      },
      { $sort: { quantidade: -1, '_id.tema': 1 } },
      {
        $project: {
          _id: 0,
          codTema: '$_id.codTema',
          tema: '$_id.tema',
          quantidade: 1,
        },
      },
    ]);
  });
});
