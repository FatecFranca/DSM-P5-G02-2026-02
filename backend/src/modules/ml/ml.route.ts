import type { FastifyPluginCallback } from 'fastify';

import { MAX_ML_TEXT_LENGTH } from './ml.service.js';
import type { MLServiceContract } from './ml.types.js';

interface MLRouteOptions {
  service: MLServiceContract;
}

interface PredictBody {
  text: string;
}

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

const modelSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'version', 'source', 'years'],
  properties: {
    name: { type: 'string' },
    version: { type: 'string' },
    source: { type: 'string', enum: ['CAMARA'] },
    years: { type: 'array', items: { type: 'integer' } },
  },
} as const;

const healthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'modelLoaded', 'modelName', 'modelVersion', 'classes'],
  properties: {
    status: { type: 'string', enum: ['ok'] },
    modelLoaded: { type: 'boolean', enum: [true] },
    modelName: { type: 'string' },
    modelVersion: { type: 'string' },
    classes: { type: 'integer', minimum: 1 },
  },
} as const;

const predictionResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['labels', 'labelCount', 'model'],
  properties: {
    labels: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'name', 'decisionScore'],
        properties: {
          code: { type: 'string' },
          name: { type: 'string' },
          decisionScore: {
            type: 'number',
            description:
              'Margem técnica do LinearSVC; não é probabilidade nem percentual.',
          },
        },
      },
    },
    labelCount: { type: 'integer', minimum: 0 },
    model: modelSchema,
  },
} as const;

export const mlRoutes: FastifyPluginCallback<MLRouteOptions> = (
  app,
  options,
  done,
) => {
  app.get(
    '/api/ml/health',
    {
      schema: {
        tags: ['Machine Learning'],
        summary: 'Consulta readiness do serviço interno de classificação',
        description:
          'Verifica conexão com o modelo temático da Câmara sem afetar o health principal do backend.',
        response: {
          200: healthResponseSchema,
          502: errorSchema,
          503: errorSchema,
          504: errorSchema,
          500: errorSchema,
        },
      },
    },
    async () => options.service.health(),
  );

  app.post<{ Body: PredictBody }>(
    '/api/ml/predict',
    {
      preValidation: (request, _reply, doneValidation) => {
        const body = request.body as { text?: unknown } | null;
        if (
          body !== null &&
          typeof body === 'object' &&
          'text' in body &&
          typeof body.text !== 'string'
        ) {
          const error = Object.assign(new Error('Tipo de texto inválido.'), {
            validation: [],
          });
          doneValidation(error);
          return;
        }
        doneValidation();
      },
      schema: {
        tags: ['Machine Learning'],
        summary: 'Classifica uma ementa em temas oficiais da Câmara',
        description:
          'Classificação temática somente. decisionScore é margem do LinearSVC e não é probabilidade.',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['text'],
          properties: {
            text: {
              type: 'string',
              minLength: 1,
              maxLength: MAX_ML_TEXT_LENGTH,
              pattern: '\\S',
            },
          },
        },
        response: {
          200: predictionResponseSchema,
          400: errorSchema,
          502: errorSchema,
          503: errorSchema,
          504: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request) => {
      const startedAt = performance.now();
      request.log.info(
        { operation: 'ml.predict' },
        'Classificação ML iniciada',
      );
      try {
        const result = await options.service.predict(request.body.text);
        request.log.info(
          {
            operation: 'ml.predict',
            durationMs: performance.now() - startedAt,
            labelCount: result.labelCount,
          },
          'Classificação ML concluída',
        );
        return result;
      } catch (error) {
        request.log.warn(
          {
            operation: 'ml.predict',
            durationMs: performance.now() - startedAt,
            errorName: error instanceof Error ? error.name : 'UnknownError',
          },
          'Classificação ML falhou',
        );
        throw error;
      }
    },
  );

  done();
};
