import { AppError } from '../../shared/errors/app-error.js';

export class CamaraUnavailableError extends AppError {
  constructor(cause?: unknown) {
    super({
      code: 'CAMARA_UNAVAILABLE',
      message: 'Não foi possível consultar a API da Câmara.',
      statusCode: 502,
      cause,
    });
  }
}

export class CamaraTimeoutError extends AppError {
  constructor(cause?: unknown) {
    super({
      code: 'CAMARA_TIMEOUT',
      message: 'A API da Câmara não respondeu no tempo esperado.',
      statusCode: 504,
      cause,
    });
  }
}

export class CamaraInvalidResponseError extends AppError {
  constructor(cause?: unknown) {
    super({
      code: 'CAMARA_INVALID_RESPONSE',
      message: 'A API da Câmara retornou uma resposta inválida.',
      statusCode: 502,
      cause,
    });
  }
}

export class DeputadoNotFoundError extends AppError {
  constructor() {
    super({
      code: 'DEPUTADO_NOT_FOUND',
      message: 'Deputado não encontrado.',
      statusCode: 404,
    });
  }
}

export class ProposicaoNotFoundError extends AppError {
  constructor() {
    super({
      code: 'PROPOSICAO_NOT_FOUND',
      message: 'Proposição não encontrada.',
      statusCode: 404,
    });
  }
}
