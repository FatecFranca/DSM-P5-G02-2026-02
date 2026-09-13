import type { Model } from 'mongoose';

import {
  ParticipacaoOrgaoModel,
  type ParticipacaoOrgaoPersistence,
  VotoModel,
  type VotoPersistence,
} from './indicador.model.js';
import type {
  IndicadorListQuery,
  OrgaoParlamentarRecord,
  ParlamentarIndicadoresRepositoryContract,
  VotacaoParlamentarRecord,
} from './parlamentar-indicadores.types.js';

function periodFilter(query: IndicadorListQuery) {
  return {
    source: query.source,
    parlamentarExternalId: query.parlamentarExternalId,
    data: { $gte: query.inicio, $lt: query.fimExclusivo },
  };
}

function membershipFilter(query: IndicadorListQuery) {
  return {
    source: query.source,
    parlamentarExternalId: query.parlamentarExternalId,
    inicio: { $ne: null, $lt: query.fimExclusivo },
    $or: [{ fim: null }, { fim: { $gte: query.inicio } }],
  };
}

export class ParlamentarIndicadoresRepository implements ParlamentarIndicadoresRepositoryContract {
  constructor(
    private readonly votoModel: Model<VotoPersistence> = VotoModel,
    private readonly participacaoModel: Model<ParticipacaoOrgaoPersistence> = ParticipacaoOrgaoModel,
  ) {}

  async listVotacoes(query: IndicadorListQuery) {
    const filter = periodFilter(query);
    const [data, total] = await Promise.all([
      this.votoModel
        .aggregate<VotacaoParlamentarRecord>([
          { $match: filter },
          { $sort: { data: -1, votacaoExternalId: 1 } },
          { $skip: (query.page - 1) * query.limit },
          { $limit: query.limit },
          {
            $lookup: {
              from: 'votacoes',
              let: {
                source: '$source',
                externalId: '$votacaoExternalId',
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$source', '$$source'] },
                        { $eq: ['$externalId', '$$externalId'] },
                      ],
                    },
                  },
                },
              ],
              as: 'votacao',
            },
          },
          { $unwind: '$votacao' },
          {
            $project: {
              _id: 0,
              votacaoExternalId: 1,
              data: 1,
              voto: 1,
              descricao: '$votacao.descricao',
              resultado: '$votacao.resultado',
              casa: '$votacao.casa',
              proposicaoExternalId: '$votacao.proposicaoExternalId',
            },
          },
        ])
        .exec(),
      this.votoModel.countDocuments(filter).exec(),
    ]);
    return { data, total };
  }

  async listOrgaos(query: IndicadorListQuery) {
    const filter = membershipFilter(query);
    const [documents, total] = await Promise.all([
      this.participacaoModel
        .find(filter)
        .sort({ inicio: -1, orgaoExternalId: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean()
        .exec(),
      this.participacaoModel.countDocuments(filter).exec(),
    ]);
    const data: OrgaoParlamentarRecord[] = documents.map((document) => ({
      orgaoExternalId: document.orgaoExternalId,
      sigla: document.sigla,
      nome: document.nome,
      casa: document.casa,
      funcao: document.funcao ?? null,
      inicio: document.inicio ?? null,
      fim: document.fim ?? null,
    }));
    return { data, total };
  }
}
