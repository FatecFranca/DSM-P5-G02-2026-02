import type { FastifyPluginCallback } from 'fastify';

import type { ProposicoesServiceContract } from './proposicoes.types.js';
import type { ProposicaoSource } from './proposicao.types.js';

interface ProposicoesRouteOptions {
  service: ProposicoesServiceContract;
}

interface ListQuery {
  page?: number;
  limit?: number;
  ano?: number;
  tipo?: string;
  source?: ProposicaoSource;
}

interface DetailQuery {
  source?: ProposicaoSource;
}

interface IdParams {
  id: number;
}

const nullableStringSchema = {
  anyOf: [{ type: 'string' }, { type: 'null' }],
} as const;

export const proposicaoErrorSchema = {
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

const authorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['externalId', 'nome', 'tipo', 'uri', 'parlamentarExternalId'],
  properties: {
    externalId: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    nome: { type: 'string' },
    tipo: { type: 'string' },
    uri: nullableStringSchema,
    parlamentarExternalId: {
      anyOf: [{ type: 'integer' }, { type: 'null' }],
    },
  },
} as const;

export const propositionSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'externalId',
    'source',
    'tipo',
    'numero',
    'ano',
    'ementa',
    'descricao',
    'dataApresentacao',
    'situacao',
    'uri',
    'urlFonte',
    'autores',
    'temasOficiais',
    'fetchedAt',
  ],
  properties: {
    externalId: { type: 'integer' },
    source: { type: 'string', enum: ['CAMARA', 'SENADO'] },
    tipo: { type: 'string' },
    numero: { type: 'integer' },
    ano: { type: 'integer' },
    ementa: nullableStringSchema,
    descricao: nullableStringSchema,
    dataApresentacao: nullableStringSchema,
    situacao: nullableStringSchema,
    uri: { type: 'string' },
    urlFonte: nullableStringSchema,
    autores: { type: 'array', items: authorSchema },
    temasOficiais: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['codTema', 'tema'],
        properties: {
          codTema: { type: 'integer' },
          tema: { type: 'string' },
        },
      },
    },
    fetchedAt: { type: 'string' },
  },
} as const;

export const proposicaoPaginationSchema = {
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

const listQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    ano: { type: 'integer', minimum: 1900 },
    tipo: { type: 'string', minLength: 1, maxLength: 20 },
    source: { type: 'string', enum: ['CAMARA', 'SENADO'] },
  },
} as const;

export const proposicaoListResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['data', 'pagination'],
  properties: {
    data: { type: 'array', items: propositionSchema },
    pagination: proposicaoPaginationSchema,
  },
} as const;

export const proposicaoIdParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'integer', minimum: 1 } },
} as const;

export const proposicoesRoutes: FastifyPluginCallback<
  ProposicoesRouteOptions
> = (app, options, done) => {
  app.get<{ Querystring: ListQuery }>(
    '/api/proposicoes',
    {
      schema: {
        tags: ['Proposições'],
        summary: 'Lista proposições armazenadas no MongoDB',
        description:
          'Retorna proposições sincronizadas com paginação e filtros opcionais por fonte, ano e tipo.',
        querystring: listQuerySchema,
        response: {
          200: proposicaoListResponseSchema,
          400: proposicaoErrorSchema,
          500: proposicaoErrorSchema,
        },
      },
    },
    async (request) =>
      options.service.list({
        page: request.query.page ?? 1,
        limit: request.query.limit ?? 20,
        ...(request.query.ano === undefined ? {} : { ano: request.query.ano }),
        ...(request.query.tipo === undefined
          ? {}
          : { tipo: request.query.tipo }),
        ...(request.query.source === undefined
          ? {}
          : { source: request.query.source }),
      }),
  );

  app.get<{ Params: IdParams; Querystring: DetailQuery }>(
    '/api/proposicoes/:id',
    {
      schema: {
        tags: ['Proposições'],
        summary: 'Consulta uma proposição por seu ID oficial e fonte',
        description:
          'Retorna uma proposição sincronizada, usando Câmara como fonte padrão quando a fonte não é informada.',
        params: proposicaoIdParamsSchema,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            source: {
              type: 'string',
              enum: ['CAMARA', 'SENADO'],
              default: 'CAMARA',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['data'],
            properties: { data: propositionSchema },
          },
          400: proposicaoErrorSchema,
          404: proposicaoErrorSchema,
          500: proposicaoErrorSchema,
        },
      },
    },
    async (request) =>
      options.service.getById(request.params.id, request.query.source),
  );

  app.get<{ Params: IdParams; Querystring: ListQuery }>(
    '/api/parlamentares/deputados/:id/proposicoes',
    {
      schema: {
        tags: ['Proposições', 'Parlamentares'],
        summary: 'Lista proposições relacionadas a um deputado no MongoDB',
        description:
          'Retorna as proposições sincronizadas que possuem vínculo de autoria com o deputado informado.',
        params: proposicaoIdParamsSchema,
        querystring: {
          ...listQuerySchema,
          properties: {
            page: listQuerySchema.properties.page,
            limit: listQuerySchema.properties.limit,
          },
        },
        response: {
          200: proposicaoListResponseSchema,
          400: proposicaoErrorSchema,
          404: proposicaoErrorSchema,
          500: proposicaoErrorSchema,
        },
      },
    },
    async (request) =>
      options.service.listByParlamentar(request.params.id, {
        page: request.query.page ?? 1,
        limit: request.query.limit ?? 20,
      }),
  );

  done();
};
