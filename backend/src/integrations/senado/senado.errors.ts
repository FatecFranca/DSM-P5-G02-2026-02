import { AppError } from '../../shared/errors/app-error.js';

export class SenadoUnavailableError extends AppError {
  constructor(cause?: unknown) {
    super({
      code: 'SENADO_UNAVAILABLE',
      message: 'Não foi possível consultar a API do Senado.',
      statusCode: 502,
      cause,
    });
  }
}

export class SenadoTimeoutError extends AppError {
  constructor(cause?: unknown) {
    super({
      code: 'SENADO_TIMEOUT',
      message: 'A API do Senado não respondeu no tempo esperado.',
      statusCode: 504,
      cause,
    });
  }
}

export class SenadoInvalidResponseError extends AppError {
  constructor(cause?: unknown) {
    super({
      code: 'SENADO_INVALID_RESPONSE',
      message: 'A API do Senado retornou uma resposta inválida.',
      statusCode: 502,
      cause,
    });
  }
}

export class SenadorNotFoundError extends AppError {
  constructor() {
    super({
      code: 'SENADOR_NOT_FOUND',
      message: 'Senador não encontrado.',
      statusCode: 404,
    });
  }
}

export class SenadoMateriaNotFoundError extends AppError {
  constructor() {
    super({
      code: 'SENADO_MATERIA_NOT_FOUND',
      message: 'Matéria do Senado não encontrada.',
      statusCode: 404,
    });
  }
}
