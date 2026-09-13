import type { FastifyPluginCallback } from 'fastify';

import {
  proposicaoErrorSchema,
  proposicaoIdParamsSchema,
  proposicaoListResponseSchema,
} from './proposicoes.route.js';
import type { SenadoMateriasServiceContract } from './senado-materia.types.js';

interface SenadoMateriasRouteOptions {
  service: SenadoMateriasServiceContract;
}

interface IdParams {
  id: number;
}

interface PaginationQuery {
  page?: number;
  limit?: number;
}

export const senadoMateriasRoutes: FastifyPluginCallback<
  SenadoMateriasRouteOptions
> = (app, options, done) => {
  app.get<{ Params: IdParams; Querystring: PaginationQuery }>(
    '/api/parlamentares/senadores/:id/proposicoes',
    {
      schema: {
        tags: ['Proposições', 'Parlamentares'],
        summary: 'Lista matérias relacionadas a um senador no MongoDB',
        description:
          'Retorna as matérias sincronizadas que possuem vínculo de autoria com o senador informado.',
        params: proposicaoIdParamsSchema,
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
          200: proposicaoListResponseSchema,
          400: proposicaoErrorSchema,
          404: proposicaoErrorSchema,
          500: proposicaoErrorSchema,
        },
      },
    },
    async (request) =>
      options.service.listBySenator(request.params.id, {
        page: request.query.page ?? 1,
        limit: request.query.limit ?? 20,
      }),
  );

  done();
};
