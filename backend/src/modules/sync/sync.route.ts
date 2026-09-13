import type { FastifyPluginCallback } from 'fastify';

import type {
  CamaraIndicadorSyncInput,
  CamaraIndicadorSyncServiceContract,
  CamaraSyncServiceContract,
  IndicadorSyncInput,
  ProposicaoSyncInput,
  ProposicaoSyncServiceContract,
  SenadoMateriaSyncInput,
  SenadoMateriaSyncServiceContract,
  SenadoIndicadorSyncServiceContract,
  SenadoSyncServiceContract,
} from './sync.types.js';

interface SyncRouteOptions {
  service: CamaraSyncServiceContract;
  proposicaoService: ProposicaoSyncServiceContract;
  senadoService: SenadoSyncServiceContract;
  senadoMateriaService: SenadoMateriaSyncServiceContract;
  camaraIndicadorService: CamaraIndicadorSyncServiceContract;
  senadoIndicadorService: SenadoIndicadorSyncServiceContract;
}

type IndicadorSyncBody = Omit<
  IndicadorSyncInput,
  'maxVotacoes' | 'maxOrgaos'
> & {
  maxVotacoes?: number;
  maxOrgaos?: number;
};

type CamaraIndicadorSyncBody = IndicadorSyncBody & {
  orgaoId?: number;
};

const errorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
} as const;

const indicadorSyncProperties = {
  parlamentarExternalId: { type: 'integer', minimum: 1 },
  dataInicio: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  dataFim: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  maxVotacoes: {
    type: 'integer',
    minimum: 1,
    maximum: 10,
    default: 5,
  },
  maxOrgaos: {
    type: 'integer',
    minimum: 1,
    maximum: 20,
    default: 20,
  },
} as const;

function indicadorSyncResponseSchema(source: 'CAMARA' | 'SENADO') {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'source',
      'resource',
      'status',
      'processed',
      'inserted',
      'updated',
      'unchanged',
      'errors',
    ],
    properties: {
      source: { type: 'string', enum: [source] },
      resource: { type: 'string', enum: ['INDICADORES'] },
      status: { type: 'string', enum: ['SUCCESS', 'PARTIAL'] },
      processed: { type: 'integer', minimum: 0 },
      inserted: { type: 'integer', minimum: 0 },
      updated: { type: 'integer', minimum: 0 },
      unchanged: { type: 'integer', minimum: 0 },
      errors: { type: 'array', items: { type: 'string' } },
    },
  } as const;
}

export const syncRoutes: FastifyPluginCallback<SyncRouteOptions> = (
  app,
  options,
  done,
) => {
  app.post(
    '/api/sync/camara/deputados',
    {
      schema: {
        tags: ['Sincronização'],
        summary: 'Sincroniza deputados da Câmara no MongoDB',
        description:
          'Endpoint administrativo provisório para desenvolvimento. Ainda não possui autenticação.',
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: [
              'source',
              'resource',
              'status',
              'processed',
              'inserted',
              'updated',
              'unchanged',
            ],
            properties: {
              source: { type: 'string', enum: ['CAMARA'] },
              resource: { type: 'string', enum: ['DEPUTADOS'] },
              status: { type: 'string', enum: ['SUCCESS'] },
              processed: { type: 'integer', minimum: 0 },
              inserted: { type: 'integer', minimum: 0 },
              updated: { type: 'integer', minimum: 0 },
              unchanged: { type: 'integer', minimum: 0 },
            },
          },
          500: errorSchema,
          502: errorSchema,
          504: errorSchema,
        },
      },
    },
    async () => options.service.syncDeputados(),
  );

  app.post<{ Body: ProposicaoSyncInput }>(
    '/api/sync/camara/proposicoes',
    {
      schema: {
        tags: ['Sincronização'],
        summary: 'Sincroniza um escopo controlado de proposições da Câmara',
        description:
          'Endpoint administrativo provisório para desenvolvimento. Exige ano, de 1 a 10 deputados existentes e limita a importação a no máximo 50 proposições.',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['ano', 'deputadoIds'],
          properties: {
            ano: { type: 'integer', minimum: 1900 },
            deputadoIds: {
              type: 'array',
              minItems: 1,
              maxItems: 10,
              uniqueItems: true,
              items: { type: 'integer', minimum: 1 },
            },
            maxProposicoes: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              default: 20,
            },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: [
              'source',
              'resource',
              'status',
              'processed',
              'inserted',
              'updated',
              'unchanged',
              'errors',
            ],
            properties: {
              source: { type: 'string', enum: ['CAMARA'] },
              resource: { type: 'string', enum: ['PROPOSICOES'] },
              status: { type: 'string', enum: ['SUCCESS', 'PARTIAL'] },
              processed: { type: 'integer', minimum: 0 },
              inserted: { type: 'integer', minimum: 0 },
              updated: { type: 'integer', minimum: 0 },
              unchanged: { type: 'integer', minimum: 0 },
              errors: { type: 'array', items: { type: 'string' } },
            },
          },
          400: errorSchema,
          404: errorSchema,
          500: errorSchema,
          502: errorSchema,
          504: errorSchema,
        },
      },
    },
    async (request) =>
      options.proposicaoService.syncProposicoes({
        ...request.body,
        maxProposicoes: request.body.maxProposicoes ?? 20,
      }),
  );

  app.post(
    '/api/sync/senado/senadores',
    {
      schema: {
        tags: ['Sincronização'],
        summary: 'Sincroniza senadores atuais do Senado no MongoDB',
        description:
          'Endpoint administrativo provisório para desenvolvimento. Consulta a lista oficial completa de senadores em exercício sem excluir registros ausentes.',
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: [
              'source',
              'resource',
              'status',
              'processed',
              'inserted',
              'updated',
              'unchanged',
              'errors',
            ],
            properties: {
              source: { type: 'string', enum: ['SENADO'] },
              resource: { type: 'string', enum: ['SENADORES'] },
              status: { type: 'string', enum: ['SUCCESS'] },
              processed: { type: 'integer', minimum: 0 },
              inserted: { type: 'integer', minimum: 0 },
              updated: { type: 'integer', minimum: 0 },
              unchanged: { type: 'integer', minimum: 0 },
              errors: { type: 'array', items: { type: 'string' } },
            },
          },
          500: errorSchema,
          502: errorSchema,
          504: errorSchema,
        },
      },
    },
    async () => options.senadoService.syncSenators(),
  );

  app.post<{ Body: SenadoMateriaSyncInput }>(
    '/api/sync/senado/materias',
    {
      schema: {
        tags: ['Sincronização'],
        summary: 'Sincroniza um escopo controlado de matérias do Senado',
        description:
          'Endpoint administrativo provisório para desenvolvimento. Exige ano, de 1 a 10 senadores existentes e limita a importação a no máximo 50 matérias.',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['ano', 'senadorIds'],
          properties: {
            ano: { type: 'integer', minimum: 1900 },
            senadorIds: {
              type: 'array',
              minItems: 1,
              maxItems: 10,
              uniqueItems: true,
              items: { type: 'integer', minimum: 1 },
            },
            siglas: {
              type: 'array',
              maxItems: 5,
              uniqueItems: true,
              default: [],
              items: { type: 'string', minLength: 1, maxLength: 20 },
            },
            maxMaterias: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              default: 20,
            },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: [
              'source',
              'resource',
              'status',
              'processed',
              'inserted',
              'updated',
              'unchanged',
              'errors',
            ],
            properties: {
              source: { type: 'string', enum: ['SENADO'] },
              resource: { type: 'string', enum: ['MATERIAS'] },
              status: { type: 'string', enum: ['SUCCESS', 'PARTIAL'] },
              processed: { type: 'integer', minimum: 0 },
              inserted: { type: 'integer', minimum: 0 },
              updated: { type: 'integer', minimum: 0 },
              unchanged: { type: 'integer', minimum: 0 },
              errors: { type: 'array', items: { type: 'string' } },
            },
          },
          400: errorSchema,
          404: errorSchema,
          500: errorSchema,
          502: errorSchema,
          504: errorSchema,
        },
      },
    },
    async (request) =>
      options.senadoMateriaService.syncMaterias({
        ...request.body,
        siglas: request.body.siglas ?? [],
        maxMaterias: request.body.maxMaterias ?? 20,
      }),
  );

  app.post<{ Body: CamaraIndicadorSyncBody }>(
    '/api/sync/camara/indicadores',
    {
      schema: {
        tags: ['Sincronização', 'Indicadores'],
        summary: 'Sincroniza indicadores objetivos de um deputado',
        description:
          'Consulta no máximo 10 votações sequencialmente e 20 participações em órgãos, em uma janela máxima de 31 dias. processed soma votações, votos e participações normalizados.',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['parlamentarExternalId', 'dataInicio', 'dataFim'],
          properties: {
            ...indicadorSyncProperties,
            orgaoId: { type: 'integer', minimum: 1 },
          },
        },
        response: {
          200: indicadorSyncResponseSchema('CAMARA'),
          400: errorSchema,
          404: errorSchema,
          500: errorSchema,
          502: errorSchema,
          504: errorSchema,
        },
      },
    },
    async (request) =>
      options.camaraIndicadorService.syncIndicadores({
        ...request.body,
        maxVotacoes: request.body.maxVotacoes ?? 5,
        maxOrgaos: request.body.maxOrgaos ?? 20,
      } satisfies CamaraIndicadorSyncInput),
  );

  app.post<{ Body: IndicadorSyncBody }>(
    '/api/sync/senado/indicadores',
    {
      schema: {
        tags: ['Sincronização', 'Indicadores'],
        summary: 'Sincroniza indicadores objetivos de um senador',
        description:
          'Consulta votos nominais no período e a lista atual de comissões, limitando localmente a 10 votações e 20 participações. processed soma votações, votos e participações normalizados.',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['parlamentarExternalId', 'dataInicio', 'dataFim'],
          properties: indicadorSyncProperties,
        },
        response: {
          200: indicadorSyncResponseSchema('SENADO'),
          400: errorSchema,
          404: errorSchema,
          500: errorSchema,
          502: errorSchema,
          504: errorSchema,
        },
      },
    },
    async (request) =>
      options.senadoIndicadorService.syncIndicadores({
        ...request.body,
        maxVotacoes: request.body.maxVotacoes ?? 5,
        maxOrgaos: request.body.maxOrgaos ?? 20,
      }),
  );

  done();
};
