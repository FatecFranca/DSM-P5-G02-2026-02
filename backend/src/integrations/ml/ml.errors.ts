import { AppError } from '../../shared/errors/app-error.js';

export class MLUnavailableError extends AppError {
  constructor(cause?: unknown) {
    super({
      code: 'ML_SERVICE_UNAVAILABLE',
      message: 'Serviço de classificação temporariamente indisponível.',
      statusCode: 503,
      cause,
    });
  }
}

export class MLTimeoutError extends AppError {
  constructor(cause?: unknown) {
    super({
      code: 'ML_SERVICE_TIMEOUT',
      message: 'O serviço de classificação não respondeu no tempo esperado.',
      statusCode: 504,
      cause,
    });
  }
}

export class MLInvalidResponseError extends AppError {
  constructor(cause?: unknown) {
    super({
      code: 'ML_INVALID_RESPONSE',
      message: 'O serviço de classificação retornou uma resposta inválida.',
      statusCode: 502,
      cause,
    });
  }
}
