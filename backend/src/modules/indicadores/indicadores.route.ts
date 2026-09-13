import type { FastifyPluginCallback } from 'fastify';

import { proposicaoErrorSchema } from '../proposicoes/proposicoes.route.js';
import type { ParlamentarIndicadoresServiceContract } from './parlamentar-indicadores.types.js';
import type { ParlamentarStatsServiceContract } from './parlamentar-stats.types.js';

interface IndicadoresRouteOptions {
  service: ParlamentarStatsServiceContract;
  queryService: ParlamentarIndicadoresServiceContract;
}

interface IdParams {
  id: number;
}

interface PeriodQuery {
  dataInicio: string;
  dataFim: string;
}

interface ListQuery extends PeriodQuery {
  page?: number;
  limit?: number;
}

const idSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'integer', minimum: 1 } },
} as const;

const periodSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['dataInicio', 'dataFim'],
  properties: {
    dataInicio: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    dataFim: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  },
} as const;

const listQuerySchema = {
  ...periodSchema,
  properties: {
    ...periodSchema.properties,
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
} as const;

const paginationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['page', 'limit', 'total', 'totalPages'],
  properties: {
    page: { type: 'integer' },
    limit: { type: 'integer' },
    total: { type: 'integer', minimum: 0 },
    totalPages: { type: 'integer', minimum: 0 },
  },
} as const;

const nullableStringSchema = {
  anyOf: [{ type: 'string' }, { type: 'null' }],
} as const;

const votacaoListResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['data', 'pagination'],
  properties: {
    data: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'votacaoExternalId',
          'data',
          'voto',
          'descricao',
          'resultado',
          'casa',
          'proposicaoExternalId',
        ],
        properties: {
          votacaoExternalId: { type: 'string' },
          data: { type: 'string' },
          voto: { type: 'string' },
          descricao: nullableStringSchema,
          resultado: nullableStringSchema,
          casa: { type: 'string' },
          proposicaoExternalId: {
            anyOf: [{ type: 'integer' }, { type: 'null' }],
          },
        },
      },
    },
    pagination: paginationSchema,
  },
} as const;

const orgaoListResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['data', 'pagination'],
  properties: {
    data: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'orgaoExternalId',
          'sigla',
          'nome',
          'casa',
          'funcao',
          'inicio',
          'fim',
        ],
        properties: {
          orgaoExternalId: { type: 'integer' },
          sigla: { type: 'string' },
          nome: { type: 'string' },
          casa: { type: 'string' },
          funcao: nullableStringSchema,
          inicio: nullableStringSchema,
          fim: nullableStringSchema,
        },
      },
    },
    pagination: paginationSchema,
  },
} as const;

const statsResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['parlamentar', 'periodo', 'estatisticas', 'temas'],
  properties: {
    parlamentar: {
      type: 'object',
      additionalProperties: false,
      required: ['externalId', 'source'],
      properties: {
        externalId: { type: 'integer' },
        source: { type: 'string', enum: ['CAMARA', 'SENADO'] },
      },
    },
    periodo: {
      type: 'object',
      additionalProperties: false,
      required: ['inicio', 'fim'],
      properties: {
        inicio: { type: 'string' },
        fim: { type: 'string' },
      },
    },
    estatisticas: {
      type: 'object',
      additionalProperties: false,
      required: [
        'proposicoes',
        'votacoes',
        'comissoesOrgaos',
        'temasDistintos',
      ],
      properties: {
        proposicoes: { type: 'integer', minimum: 0 },
        votacoes: { type: 'integer', minimum: 0 },
        comissoesOrgaos: { type: 'integer', minimum: 0 },
        temasDistintos: { type: 'integer', minimum: 0 },
      },
    },
    temas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['codTema', 'tema', 'quantidade'],
        properties: {
          codTema: { type: 'integer' },
          tema: { type: 'string' },
          quantidade: { type: 'integer', minimum: 1 },
        },
      },
    },
  },
} as const;

export const indicadoresRoutes: FastifyPluginCallback<
  IndicadoresRouteOptions
> = (app, options, done) => {
  const register = (
    path: string,
    source: 'CAMARA' | 'SENADO',
    label: string,
  ) => {
    app.get<{ Params: IdParams; Querystring: PeriodQuery }>(
      path,
      {
        schema: {
          tags: ['Indicadores'],
          summary: `Consulta estatísticas objetivas de um ${label}`,
          description:
            'As contagens representam somente dados persistidos e sincronizados dentro do período solicitado. Não são nota, ranking ou avaliação de qualidade.',
          params: idSchema,
          querystring: periodSchema,
          response: {
            200: statsResponseSchema,
            400: proposicaoErrorSchema,
            404: proposicaoErrorSchema,
            500: proposicaoErrorSchema,
          },
        },
      },
      async (request) =>
        options.service.getStats(source, request.params.id, request.query),
    );
  };

  register(
    '/api/parlamentares/deputados/:id/estatisticas',
    'CAMARA',
    'deputado',
  );
  register(
    '/api/parlamentares/senadores/:id/estatisticas',
    'SENADO',
    'senador',
  );

  const registerLists = (prefix: string, source: 'CAMARA' | 'SENADO') => {
    app.get<{ Params: IdParams; Querystring: ListQuery }>(
      `${prefix}/votacoes`,
      {
        schema: {
          tags: ['Indicadores'],
          summary: 'Lista votos oficiais sincronizados do parlamentar',
          description:
            'Retorna valores oficiais de voto sem interpretação qualitativa. Os dados vêm somente do MongoDB.',
          params: idSchema,
          querystring: listQuerySchema,
          response: {
            200: votacaoListResponseSchema,
            400: proposicaoErrorSchema,
            404: proposicaoErrorSchema,
            500: proposicaoErrorSchema,
          },
        },
      },
      async (request) =>
        options.queryService.listVotacoes(source, request.params.id, {
          dataInicio: request.query.dataInicio,
          dataFim: request.query.dataFim,
          page: request.query.page ?? 1,
          limit: request.query.limit ?? 20,
        }),
    );
    app.get<{ Params: IdParams; Querystring: ListQuery }>(
      `${prefix}/orgaos`,
      {
        schema: {
          tags: ['Indicadores'],
          summary: 'Lista órgãos e comissões sincronizados do parlamentar',
          description:
            'Preserva função e período oficiais. A ausência de data final não é convertida em avaliação ou score.',
          params: idSchema,
          querystring: listQuerySchema,
          response: {
            200: orgaoListResponseSchema,
            400: proposicaoErrorSchema,
            404: proposicaoErrorSchema,
            500: proposicaoErrorSchema,
          },
        },
      },
      async (request) =>
        options.queryService.listOrgaos(source, request.params.id, {
          dataInicio: request.query.dataInicio,
          dataFim: request.query.dataFim,
          page: request.query.page ?? 1,
          limit: request.query.limit ?? 20,
        }),
    );
  };

  registerLists('/api/parlamentares/deputados/:id', 'CAMARA');
  registerLists('/api/parlamentares/senadores/:id', 'SENADO');
  done();
};
