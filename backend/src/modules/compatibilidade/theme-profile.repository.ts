import type { Model, PipelineStage } from 'mongoose';

import {
  ParlamentarModel,
  type ParlamentarPersistence,
} from '../parlamentares/parlamentar.model.js';
import {
  ProposicaoModel,
  type ProposicaoPersistence,
} from '../proposicoes/proposicao.model.js';
import { CAMARA_THEMES } from '../temas/camara-temas.catalog.js';
import type {
  AggregateEvidenceQuery,
  AggregateProfilesQuery,
  EvidenceAggregation,
  ProfileAggregation,
  ProfileParliamentarian,
  ThemeProfileRepositoryContract,
  ThemeSourceMode,
} from './theme-profile.types.js';

function toParliamentarian(document: {
  externalId: number;
  nome: string;
  partido?: string | null;
  uf?: string | null;
}): ProfileParliamentarian {
  return {
    id: document.externalId,
    name: document.nome,
    party: document.partido ?? null,
    uf: document.uf ?? null,
  };
}

const supportedCodes = CAMARA_THEMES.map(({ code }) => code);

function themeCodeExpression(path: string): Record<string, unknown> {
  return {
    $setUnion: [
      {
        $filter: {
          input: {
            $map: {
              input: { $ifNull: [path, []] },
              as: 'theme',
              in: '$$theme.codTema',
            },
          },
          as: 'themeCode',
          cond: { $in: ['$$themeCode', supportedCodes] },
        },
      },
      [],
    ],
  };
}

function selectedThemeExpression(themeSource: ThemeSourceMode) {
  return themeSource === 'official'
    ? '$officialThemeCodes'
    : {
        $cond: ['$hasOfficialThemes', '$officialThemeCodes', '$mlThemeCodes'],
      };
}

export class ThemeProfileRepository implements ThemeProfileRepositoryContract {
  constructor(
    private readonly propositionModel: Model<ProposicaoPersistence> = ProposicaoModel,
    private readonly parliamentarianModel: Model<ParlamentarPersistence> = ParlamentarModel,
  ) {}

  async findDeputy(id: number): Promise<ProfileParliamentarian | null> {
    const document = await this.parliamentarianModel
      .findOne({ source: 'CAMARA', externalId: id })
      .lean()
      .exec();
    return document ? toParliamentarian(document) : null;
  }

  async listDeputies(): Promise<ProfileParliamentarian[]> {
    const documents = await this.parliamentarianModel
      .find({ source: 'CAMARA' })
      .sort({ externalId: 1 })
      .lean()
      .exec();
    return documents.map((document) => toParliamentarian(document));
  }

  async aggregateProfiles(
    query: AggregateProfilesQuery,
  ): Promise<ProfileAggregation> {
    const themeSource = query.themeSource ?? 'official';
    const match: Record<string, unknown> = {
      source: 'CAMARA',
      ano: { $gte: query.startYear, $lte: query.endYear },
    };
    if (query.parliamentarianId !== undefined) {
      match['autores.parlamentarExternalId'] = query.parliamentarianId;
    }

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $project: {
          externalId: 1,
          title: {
            $ifNull: [
              '$ementa',
              {
                $ifNull: [
                  '$descricao',
                  {
                    $concat: [
                      '$tipo',
                      ' ',
                      { $toString: '$numero' },
                      '/',
                      { $toString: '$ano' },
                    ],
                  },
                ],
              },
            ],
          },
          parliamentarianIds: {
            $setUnion: [
              {
                $filter: {
                  input: {
                    $map: {
                      input: { $ifNull: ['$autores', []] },
                      as: 'author',
                      in: '$$author.parlamentarExternalId',
                    },
                  },
                  as: 'parliamentarianId',
                  cond: { $ne: ['$$parliamentarianId', null] },
                },
              },
              [],
            ],
          },
          officialThemeCodes: themeCodeExpression('$temasOficiais'),
          mlThemeCodes: themeCodeExpression('$mlClassification.labels'),
          mlModelVersion: '$mlClassification.modelVersion',
          hasOfficialThemes: {
            $gt: [{ $size: { $ifNull: ['$temasOficiais', []] } }, 0],
          },
        },
      },
      {
        $project: {
          externalId: 1,
          title: 1,
          parliamentarianIds: 1,
          hasOfficialThemes: 1,
          mlModelVersion: 1,
          hasMLThemes: {
            $and: [
              { $eq: ['$hasOfficialThemes', false] },
              { $gt: [{ $size: '$mlThemeCodes' }, 0] },
            ],
          },
          themeCodes: selectedThemeExpression(themeSource),
        },
      },
      { $unwind: '$parliamentarianIds' },
      ...(query.parliamentarianId === undefined
        ? []
        : [{ $match: { parliamentarianIds: query.parliamentarianId } }]),
      {
        $facet: {
          summaries: [
            {
              $group: {
                _id: '$parliamentarianIds',
                documentsAnalyzed: { $sum: 1 },
                documentsWithThemes: {
                  $sum: {
                    $cond: [{ $gt: [{ $size: '$themeCodes' }, 0] }, 1, 0],
                  },
                },
                documentsWithOfficialThemes: {
                  $sum: { $cond: ['$hasOfficialThemes', 1, 0] },
                },
                documentsWithMLThemes: {
                  $sum: { $cond: ['$hasMLThemes', 1, 0] },
                },
                documentsWithEnrichedThemes: {
                  $sum: {
                    $cond: [
                      { $or: ['$hasOfficialThemes', '$hasMLThemes'] },
                      1,
                      0,
                    ],
                  },
                },
                modelVersions: {
                  $addToSet: {
                    $cond: ['$hasMLThemes', '$mlModelVersion', null],
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                parliamentarianId: '$_id',
                documentsAnalyzed: 1,
                documentsWithThemes: 1,
                documentsWithOfficialThemes: 1,
                documentsWithMLThemes: 1,
                documentsWithEnrichedThemes: 1,
                modelVersions: {
                  $setDifference: ['$modelVersions', [null]],
                },
              },
            },
          ],
          themes: [
            { $unwind: '$themeCodes' },
            {
              $group: {
                _id: {
                  parliamentarianId: '$parliamentarianIds',
                  themeCode: '$themeCodes',
                },
                documentCount: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                parliamentarianId: '$_id.parliamentarianId',
                themeCode: '$_id.themeCode',
                documentCount: 1,
              },
            },
          ],
        },
      },
    ];

    const [aggregation] = await this.propositionModel
      .aggregate<ProfileAggregation>(pipeline)
      .exec();
    return aggregation
      ? { ...aggregation, evidence: [] }
      : { summaries: [], themes: [], evidence: [] };
  }

  async aggregateEvidence(
    query: AggregateEvidenceQuery,
  ): Promise<EvidenceAggregation[]> {
    if (
      query.parliamentarianIds.length === 0 ||
      query.themeCodes.length === 0
    ) {
      return [];
    }
    const themeSource = query.themeSource ?? 'official';
    const officialMatch = {
      'temasOficiais.codTema': { $in: query.themeCodes },
    };
    const themeMatch =
      themeSource === 'official'
        ? officialMatch
        : {
            $or: [
              officialMatch,
              {
                'temasOficiais.0': { $exists: false },
                'mlClassification.status': 'CLASSIFIED',
                'mlClassification.labels.codTema': { $in: query.themeCodes },
              },
            ],
          };

    return this.propositionModel
      .aggregate<EvidenceAggregation>([
        {
          $match: {
            source: 'CAMARA',
            ano: { $gte: query.startYear, $lte: query.endYear },
            'autores.parlamentarExternalId': {
              $in: query.parliamentarianIds,
            },
            ...themeMatch,
          },
        },
        {
          $project: {
            externalId: 1,
            title: {
              $ifNull: [
                '$ementa',
                {
                  $ifNull: [
                    '$descricao',
                    {
                      $concat: [
                        '$tipo',
                        ' ',
                        { $toString: '$numero' },
                        '/',
                        { $toString: '$ano' },
                      ],
                    },
                  ],
                },
              ],
            },
            parliamentarianIds: {
              $setUnion: [
                {
                  $filter: {
                    input: {
                      $map: {
                        input: { $ifNull: ['$autores', []] },
                        as: 'author',
                        in: '$$author.parlamentarExternalId',
                      },
                    },
                    as: 'parliamentarianId',
                    cond: {
                      $in: ['$$parliamentarianId', query.parliamentarianIds],
                    },
                  },
                },
                [],
              ],
            },
            officialThemeItems: {
              $map: {
                input: {
                  $filter: {
                    input: { $ifNull: ['$temasOficiais', []] },
                    as: 'theme',
                    cond: { $in: ['$$theme.codTema', query.themeCodes] },
                  },
                },
                as: 'theme',
                in: {
                  themeCode: '$$theme.codTema',
                  themeOrigin: { $literal: 'OFFICIAL' },
                },
              },
            },
            mlThemeItems: {
              $map: {
                input: {
                  $filter: {
                    input: { $ifNull: ['$mlClassification.labels', []] },
                    as: 'theme',
                    cond: { $in: ['$$theme.codTema', query.themeCodes] },
                  },
                },
                as: 'theme',
                in: {
                  themeCode: '$$theme.codTema',
                  themeOrigin: { $literal: 'ML' },
                  decisionScore: '$$theme.decisionScore',
                  modelName: '$mlClassification.modelName',
                  modelVersion: '$mlClassification.modelVersion',
                },
              },
            },
          },
        },
        {
          $project: {
            externalId: 1,
            title: 1,
            parliamentarianIds: 1,
            themeItems:
              themeSource === 'official'
                ? '$officialThemeItems'
                : {
                    $cond: [
                      { $gt: [{ $size: '$officialThemeItems' }, 0] },
                      '$officialThemeItems',
                      '$mlThemeItems',
                    ],
                  },
          },
        },
        { $unwind: '$parliamentarianIds' },
        { $unwind: '$themeItems' },
        {
          $sort: {
            parliamentarianIds: 1,
            'themeItems.themeCode': 1,
            externalId: 1,
          },
        },
        {
          $group: {
            _id: {
              parliamentarianId: '$parliamentarianIds',
              themeCode: '$themeItems.themeCode',
            },
            documents: {
              $push: {
                proposalId: '$externalId',
                title: '$title',
                themeOrigin: '$themeItems.themeOrigin',
                decisionScore: '$themeItems.decisionScore',
                modelName: '$themeItems.modelName',
                modelVersion: '$themeItems.modelVersion',
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            parliamentarianId: '$_id.parliamentarianId',
            themeCode: '$_id.themeCode',
            documents: { $slice: ['$documents', 3] },
          },
        },
      ])
      .exec();
  }
}
