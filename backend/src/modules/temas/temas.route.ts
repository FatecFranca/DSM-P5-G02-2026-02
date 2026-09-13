import type { FastifyPluginCallback } from 'fastify';

import { proposicaoErrorSchema } from '../proposicoes/proposicoes.route.js';
import { CAMARA_THEMES } from './camara-temas.catalog.js';

interface ThemesQuery {
  source?: 'CAMARA';
}

export const themesRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.get<{ Querystring: ThemesQuery }>(
    '/api/temas',
    {
      schema: {
        tags: ['Temas'],
        summary: 'Lista os temas disponíveis para preferências',
        description:
          'Retorna a taxonomia oficial da Câmara suportada pelo perfil e pela compatibilidade temática. Não mistura códigos do Senado.',
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            source: { type: 'string', enum: ['CAMARA'], default: 'CAMARA' },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['source', 'count', 'themes'],
            properties: {
              source: { type: 'string', enum: ['CAMARA'] },
              count: { type: 'integer', const: 32, example: 32 },
              themes: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['code', 'name'],
                  example: { code: 46, name: 'Educação' },
                  properties: {
                    code: { type: 'integer', example: 46 },
                    name: { type: 'string', example: 'Educação' },
                  },
                },
              },
            },
          },
          400: proposicaoErrorSchema,
          500: proposicaoErrorSchema,
        },
      },
    },
    () => ({
      source: 'CAMARA' as const,
      count: CAMARA_THEMES.length,
      themes: CAMARA_THEMES,
    }),
  );
  done();
};
