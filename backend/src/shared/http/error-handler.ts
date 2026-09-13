import type { FastifyInstance } from 'fastify';

import { AppError } from '../errors/app-error.js';

function hasStatusCode(error: unknown): error is { statusCode: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  );
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Rota não encontrada.',
      },
    });
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    if (typeof error === 'object' && error !== null && 'validation' in error) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados de entrada inválidos.',
        },
      });
    }

    const statusCode = hasStatusCode(error) ? error.statusCode : undefined;

    if (statusCode === 413) {
      return reply.status(413).send({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Corpo da requisição excede o limite permitido.',
        },
      });
    }

    if (statusCode === 415) {
      return reply.status(415).send({
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Tipo de conteúdo não suportado.',
        },
      });
    }

    if (statusCode === 400) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados de entrada inválidos.',
        },
      });
    }

    app.log.error(
      { errorName: error instanceof Error ? error.name : 'UnknownError' },
      'Erro interno não tratado',
    );
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Erro interno do servidor.',
      },
    });
  });
}
