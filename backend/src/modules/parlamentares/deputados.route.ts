import type { FastifyPluginCallback } from 'fastify';

import type { DeputadosServiceContract } from './deputados.types.js';

interface DeputadosRouteOptions {
  service: DeputadosServiceContract;
}

interface ListQuery {
  page?: number;
  limit?: number;
}

interface DetailParams {
  id: number;
}

const nullableStringSchema = {
  anyOf: [{ type: 'string' }, { type: 'null' }],
} as const;

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

const listItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['externalId', 'nome', 'partido', 'uf', 'fotoUrl', 'email'],
  properties: {
    externalId: { type: 'integer' },
    nome: { type: 'string' },
    partido: nullableStringSchema,
    uf: nullableStringSchema,
    fotoUrl: nullableStringSchema,
    email: nullableStringSchema,
  },
} as const;

export const deputadosRoutes: FastifyPluginCallback<DeputadosRouteOptions> = (
  app,
  options,
  done,
) => {
  app.get<{ Querystring: ListQuery }>(
    '/api/parlamentares/deputados',
    {
      schema: {
        tags: ['Parlamentares'],
        summary: 'Lista deputados consultados na API oficial da Câmara',
        description:
          'Retorna deputados armazenados com paginação e dados cadastrais obtidos da Câmara dos Deputados.',
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['data', 'pagination'],
            properties: {
              data: { type: 'array', items: listItemSchema },
              pagination: {
                type: 'object',
                additionalProperties: false,
                required: ['page', 'limit', 'total', 'totalPages'],
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer', minimum: 0 },
                  totalPages: { type: 'integer', minimum: 0 },
                },
              },
            },
          },
          400: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request) =>
      options.service.list({
        page: request.query.page ?? 1,
        limit: request.query.limit ?? 20,
      }),
  );

  app.get<{ Params: DetailParams }>(
    '/api/parlamentares/deputados/:id',
    {
      schema: {
        tags: ['Parlamentares'],
        summary: 'Consulta um deputado por seu ID oficial da Câmara',
        description:
          'Retorna os dados cadastrais armazenados de um deputado identificado pelo ID da Câmara.',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: {
            id: { type: 'integer', minimum: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['data'],
            properties: {
              data: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'externalId',
                  'source',
                  'nome',
                  'nomeCivil',
                  'partido',
                  'uf',
                  'casa',
                  'fotoUrl',
                  'email',
                  'situacao',
                ],
                example: {
                  externalId: 204379,
                  source: 'CAMARA',
                  nome: 'Deputada Exemplo',
                  nomeCivil: 'Nome Civil de Exemplo',
                  partido: 'ABC',
                  uf: 'SP',
                  casa: 'CAMARA',
                  fotoUrl: 'https://www.camara.leg.br/exemplo.jpg',
                  email: 'deputada.exemplo@camara.leg.br',
                  situacao: 'Exercício',
                },
                properties: {
                  externalId: { type: 'integer' },
                  source: { type: 'string', enum: ['CAMARA'] },
                  nome: { type: 'string' },
                  nomeCivil: nullableStringSchema,
                  partido: nullableStringSchema,
                  uf: nullableStringSchema,
                  casa: { type: 'string', enum: ['CAMARA'] },
                  fotoUrl: nullableStringSchema,
                  email: nullableStringSchema,
                  situacao: nullableStringSchema,
                },
              },
            },
          },
          400: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request) => options.service.getById(request.params.id),
  );

  done();
};
