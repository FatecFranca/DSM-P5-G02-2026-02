import type { Model } from 'mongoose';

import { ProposicaoModel } from '../proposicoes/proposicao.model.js';
import type { ProposicaoPersistence } from '../proposicoes/proposicao.model.js';
import {
  ParticipacaoOrgaoModel,
  type ParticipacaoOrgaoPersistence,
  VotoModel,
  type VotoPersistence,
} from './indicador.model.js';
import type {
  ParlamentarStatsQuery,
  ParlamentarStatsRepositoryContract,
  TemaStats,
} from './parlamentar-stats.types.js';

export class ParlamentarStatsRepository implements ParlamentarStatsRepositoryContract {
  constructor(
    private readonly proposicaoModel: Model<ProposicaoPersistence> = ProposicaoModel,
    private readonly votoModel: Model<VotoPersistence> = VotoModel,
    private readonly participacaoModel: Model<ParticipacaoOrgaoPersistence> = ParticipacaoOrgaoModel,
  ) {}

  async getStats(query: ParlamentarStatsQuery) {
    const propositionFilter = {
      source: query.source,
      'autores.parlamentarExternalId': query.parlamentarExternalId,
      dataApresentacao: { $gte: query.inicio, $lt: query.fimExclusivo },
    };
    const [proposicoes, votacoes, orgaoIds, temas] = await Promise.all([
      this.proposicaoModel.countDocuments(propositionFilter).exec(),
      this.votoModel
        .countDocuments({
          source: query.source,
          parlamentarExternalId: query.parlamentarExternalId,
          data: { $gte: query.inicio, $lt: query.fimExclusivo },
        })
        .exec(),
      this.participacaoModel
        .distinct('orgaoExternalId', {
          source: query.source,
          parlamentarExternalId: query.parlamentarExternalId,
          inicio: { $ne: null, $lt: query.fimExclusivo },
          $or: [{ fim: null }, { fim: { $gte: query.inicio } }],
        })
        .exec(),
      this.proposicaoModel
        .aggregate<TemaStats>([
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
        ])
        .exec(),
    ]);

    return {
      proposicoes,
      votacoes,
      comissoesOrgaos: orgaoIds.length,
      temas,
    };
  }
}
