import type { FastifyPluginCallback } from 'fastify';

import { AppError } from '../../shared/errors/app-error.js';
import { proposicaoErrorSchema } from '../proposicoes/proposicoes.route.js';
import { CAMARA_THEMES } from '../temas/camara-temas.catalog.js';
import type {
  CompatibilityRequest,
  CompatibilityServiceContract,
} from './compatibility.types.js';
import type {
  ThemePeriod,
  ThemeProfileServiceContract,
  ThemeSourceMode,
} from './theme-profile.types.js';

interface CompatibilityRouteOptions {
  profileService: ThemeProfileServiceContract;
  compatibilityService: CompatibilityServiceContract;
}

interface IdParams {
  id: number;
}

interface ProfileQuery {
  startYear?: number;
  endYear?: number;
  themeSource?: ThemeSourceMode;
}

const themeCodes = CAMARA_THEMES.map(({ code }) => code);
const nullableStringSchema = {
  anyOf: [{ type: 'string' }, { type: 'null' }],
} as const;
const parliamentarianSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'party', 'uf'],
  properties: {
    id: { type: 'integer', example: 204379 },
    name: { type: 'string', example: 'Deputada Exemplo' },
    party: nullableStringSchema,
    uf: nullableStringSchema,
  },
} as const;
const periodProperties = {
  startYear: { type: 'integer', minimum: 1900, maximum: 2100, example: 2023 },
  endYear: { type: 'integer', minimum: 1900, maximum: 2100, example: 2025 },
} as const;
const periodSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['startYear', 'endYear'],
  properties: periodProperties,
} as const;
const themeSourceSchema = {
  type: 'string',
  enum: ['official', 'enriched'],
  description:
    'official (padrão) usa somente temas da Câmara; enriched usa temas oficiais e, apenas na ausência deles, temas previstos por ML.',
} as const;
const themeProfileItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['code', 'name', 'documentCount', 'share'],
  example: { code: 46, name: 'Educação', documentCount: 6, share: 0.5 },
  properties: {
    code: { type: 'integer', enum: themeCodes, example: 46 },
    name: { type: 'string', example: 'Educação' },
    documentCount: { type: 'integer', minimum: 1, example: 6 },
    share: { type: 'number', minimum: 0, maximum: 1, example: 0.5 },
  },
} as const;
const profileResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'parliamentarian',
    'source',
    'period',
    'themeSource',
    'documentsAnalyzed',
    'documentsWithThemes',
    'documentsWithOfficialThemes',
    'documentsWithMLThemes',
    'documentsWithoutThemes',
    'coverage',
    'officialCoverage',
    'enrichedCoverage',
    'themes',
  ],
  example: {
    parliamentarian: {
      id: 204379,
      name: 'Deputada Exemplo',
      party: 'ABC',
      uf: 'SP',
    },
    source: 'CAMARA',
    period: { startYear: 2023, endYear: 2025 },
    themeSource: 'enriched',
    documentsAnalyzed: 12,
    documentsWithThemes: 9,
    documentsWithOfficialThemes: 8,
    documentsWithMLThemes: 1,
    documentsWithoutThemes: 3,
    coverage: 0.75,
    officialCoverage: 0.67,
    enrichedCoverage: 0.75,
    themes: [{ code: 46, name: 'Educação', documentCount: 6, share: 0.5 }],
  },
  properties: {
    parliamentarian: parliamentarianSchema,
    source: { type: 'string', enum: ['CAMARA'] },
    period: periodSchema,
    themeSource: themeSourceSchema,
    documentsAnalyzed: { type: 'integer', minimum: 0 },
    documentsWithThemes: { type: 'integer', minimum: 0 },
    documentsWithOfficialThemes: { type: 'integer', minimum: 0 },
    documentsWithMLThemes: { type: 'integer', minimum: 0 },
    documentsWithoutThemes: { type: 'integer', minimum: 0 },
    coverage: { type: 'number', minimum: 0, maximum: 1 },
    officialCoverage: { type: 'number', minimum: 0, maximum: 1 },
    enrichedCoverage: { type: 'number', minimum: 0, maximum: 1 },
    themes: { type: 'array', items: themeProfileItemSchema },
  },
} as const;
const compatibilityResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['source', 'period', 'themeSource', 'method', 'results', 'summary'],
  example: {
    source: 'CAMARA',
    period: { startYear: 2023, endYear: 2025 },
    themeSource: 'enriched',
    method: 'cosine_similarity',
    results: [
      {
        position: 1,
        parliamentarian: {
          id: 204379,
          name: 'Deputada Exemplo',
          party: 'ABC',
          uf: 'SP',
        },
        compatibility: 0.89,
        compatibilityPercent: 89,
        documentsAnalyzed: 12,
        coverage: 0.75,
        matchedThemes: [
          {
            code: 46,
            name: 'Educação',
            userWeight: 5,
            parliamentarianShare: 0.5,
          },
        ],
        evidence: [
          {
            proposalId: 123456,
            themeCode: 46,
            title: 'Proposição legislativa de exemplo',
            source: 'CAMARA',
            themeOrigin: 'OFFICIAL',
          },
        ],
      },
    ],
    summary: {
      parliamentariansConsidered: 513,
      profilesCompared: 480,
      profilesExcludedWithoutThemes: 33,
      documentsAnalyzed: 5760,
      documentsWithThemes: 4320,
      documentsWithOfficialThemes: 4000,
      documentsWithMLThemes: 320,
      coverage: 0.75,
      officialCoverage: 0.69,
      enrichedCoverage: 0.75,
      themesObserved: 32,
    },
  },
  properties: {
    source: { type: 'string', enum: ['CAMARA'] },
    period: periodSchema,
    themeSource: themeSourceSchema,
    method: { type: 'string', enum: ['cosine_similarity'] },
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'position',
          'parliamentarian',
          'compatibility',
          'compatibilityPercent',
          'documentsAnalyzed',
          'coverage',
          'matchedThemes',
          'evidence',
        ],
        properties: {
          position: { type: 'integer', minimum: 1 },
          parliamentarian: parliamentarianSchema,
          compatibility: { type: 'number', minimum: 0, maximum: 1 },
          compatibilityPercent: { type: 'number', minimum: 0, maximum: 100 },
          documentsAnalyzed: { type: 'integer', minimum: 1 },
          coverage: { type: 'number', minimum: 0, maximum: 1 },
          matchedThemes: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['code', 'name', 'userWeight', 'parliamentarianShare'],
              properties: {
                code: { type: 'integer', enum: themeCodes },
                name: { type: 'string' },
                userWeight: { type: 'integer', minimum: 1, maximum: 5 },
                parliamentarianShare: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                },
              },
            },
          },
          evidence: {
            type: 'array',
            maxItems: 3,
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'proposalId',
                'themeCode',
                'title',
                'source',
                'themeOrigin',
              ],
              properties: {
                proposalId: { type: 'integer' },
                themeCode: { type: 'integer', enum: themeCodes },
                title: { type: 'string' },
                source: { type: 'string', enum: ['CAMARA'] },
                themeOrigin: { type: 'string', enum: ['OFFICIAL', 'ML'] },
                decisionScore: { type: 'number' },
                modelName: { type: 'string' },
                modelVersion: { type: 'string' },
              },
            },
          },
        },
      },
    },
    summary: {
      type: 'object',
      additionalProperties: false,
      required: [
        'parliamentariansConsidered',
        'profilesCompared',
        'profilesExcludedWithoutThemes',
        'documentsAnalyzed',
        'documentsWithThemes',
        'documentsWithOfficialThemes',
        'documentsWithMLThemes',
        'coverage',
        'officialCoverage',
        'enrichedCoverage',
        'themesObserved',
      ],
      properties: {
        parliamentariansConsidered: { type: 'integer', minimum: 0 },
        profilesCompared: { type: 'integer', minimum: 0 },
        profilesExcludedWithoutThemes: { type: 'integer', minimum: 0 },
        documentsAnalyzed: { type: 'integer', minimum: 0 },
        documentsWithThemes: { type: 'integer', minimum: 0 },
        documentsWithOfficialThemes: { type: 'integer', minimum: 0 },
        documentsWithMLThemes: { type: 'integer', minimum: 0 },
        coverage: { type: 'number', minimum: 0, maximum: 1 },
        officialCoverage: { type: 'number', minimum: 0, maximum: 1 },
        enrichedCoverage: { type: 'number', minimum: 0, maximum: 1 },
        themesObserved: { type: 'integer', minimum: 0, maximum: 32 },
      },
    },
  },
} as const;

function throwValidationError(): never {
  throw new AppError({
    code: 'VALIDATION_ERROR',
    message: 'Dados de entrada inválidos.',
    statusCode: 400,
  });
}

function assertOrderedPeriod(period: ThemePeriod | undefined): void {
  if (period && period.startYear > period.endYear) throwValidationError();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertStrictBodyNumbers(body: unknown): void {
  if (!isRecord(body)) return;
  if ('limit' in body && typeof body['limit'] !== 'number') {
    throwValidationError();
  }
  const period = body['period'];
  if (
    isRecord(period) &&
    (typeof period['startYear'] !== 'number' ||
      typeof period['endYear'] !== 'number')
  ) {
    throwValidationError();
  }
  const preferences = body['preferences'];
  if (
    Array.isArray(preferences) &&
    preferences.some(
      (preference) =>
        isRecord(preference) &&
        (typeof preference['themeCode'] !== 'number' ||
          typeof preference['weight'] !== 'number'),
    )
  ) {
    throwValidationError();
  }
}

export const compatibilityRoutes: FastifyPluginCallback<
  CompatibilityRouteOptions
> = (app, options, done) => {
  app.get<{ Params: IdParams; Querystring: ProfileQuery }>(
    '/api/parlamentares/deputados/:id/perfil-tematico',
    {
      schema: {
        tags: ['Parlamentares', 'Temas'],
        summary: 'Consulta o perfil temático objetivo de um deputado',
        description:
          'Distribuição da atividade legislativa observada em proposições da Câmara. Perfis não medem qualidade, ideologia, competência ou intenção.',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'integer', minimum: 1 } },
        },
        querystring: {
          type: 'object',
          additionalProperties: false,
          dependencies: {
            startYear: ['endYear'],
            endYear: ['startYear'],
          },
          properties: {
            ...periodProperties,
            themeSource: themeSourceSchema,
          },
        },
        response: {
          200: profileResponseSchema,
          400: proposicaoErrorSchema,
          404: proposicaoErrorSchema,
          500: proposicaoErrorSchema,
        },
      },
    },
    async (request) => {
      const period =
        request.query.startYear === undefined ||
        request.query.endYear === undefined
          ? undefined
          : {
              startYear: request.query.startYear,
              endYear: request.query.endYear,
            };
      assertOrderedPeriod(period);
      return request.query.themeSource === undefined
        ? options.profileService.getProfile(request.params.id, period)
        : options.profileService.getProfile(
            request.params.id,
            period,
            request.query.themeSource,
          );
    },
  );

  app.post<{ Body: CompatibilityRequest }>(
    '/api/compatibilidade',
    {
      preValidation: (request, reply, doneValidation) => {
        void reply;
        assertStrictBodyNumbers(request.body);
        doneValidation();
      },
      schema: {
        tags: ['Compatibilidade'],
        summary:
          'Calcula compatibilidade temática entre preferências e deputados',
        description:
          'Usa similaridade de cosseno entre prioridades temáticas e perfis normalizados. O percentual é similaridade temática, não é probabilidade, concordância política, recomendação eleitoral ou avaliação de qualidade.',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['source', 'preferences'],
          example: {
            source: 'CAMARA',
            period: { startYear: 2023, endYear: 2025 },
            themeSource: 'enriched',
            preferences: [
              { themeCode: 46, weight: 5 },
              { themeCode: 56, weight: 3 },
            ],
            limit: 5,
          },
          properties: {
            source: { type: 'string', enum: ['CAMARA'] },
            period: periodSchema,
            themeSource: themeSourceSchema,
            preferences: {
              type: 'array',
              minItems: 1,
              maxItems: 10,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['themeCode', 'weight'],
                properties: {
                  themeCode: { type: 'integer', enum: themeCodes },
                  weight: { type: 'integer', minimum: 1, maximum: 5 },
                },
              },
            },
            limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
          },
        },
        response: {
          200: compatibilityResponseSchema,
          400: proposicaoErrorSchema,
          503: proposicaoErrorSchema,
          500: proposicaoErrorSchema,
        },
      },
    },
    async (request) => {
      assertOrderedPeriod(request.body.period);
      return options.compatibilityService.rank(request.body);
    },
  );
  done();
};
