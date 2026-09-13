import type { FastifyPluginCallback } from 'fastify';

import type { DatabaseStatus } from '../../config/database.js';

interface HealthRouteOptions {
  getDatabaseStatus: () => DatabaseStatus;
}

export const healthRoutes: FastifyPluginCallback<HealthRouteOptions> = (
  app,
  options,
  done,
) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Verifica a disponibilidade da API',
        description:
          'Informa se o backend está operacional e se a conexão com o MongoDB está disponível.',
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['status', 'database'],
            properties: {
              status: { type: 'string', enum: ['ok', 'degraded'] },
              database: {
                type: 'string',
                enum: ['connected', 'disconnected'],
              },
            },
          },
        },
      },
    },
    () => {
      const database = options.getDatabaseStatus();

      return {
        status: database === 'connected' ? 'ok' : 'degraded',
        database,
      };
    },
  );

  done();
};
