import { AppError } from '../../shared/errors/app-error.js';

export class IndicadorInvalidPeriodError extends AppError {
  constructor() {
    super({
      code: 'INDICADOR_INVALID_PERIOD',
      message: 'O período deve ser válido e ter no máximo 31 dias.',
      statusCode: 400,
    });
  }
}

export class EstatisticaInvalidPeriodError extends AppError {
  constructor() {
    super({
      code: 'ESTATISTICA_INVALID_PERIOD',
      message: 'O período informado para as estatísticas é inválido.',
      statusCode: 400,
    });
  }
}
