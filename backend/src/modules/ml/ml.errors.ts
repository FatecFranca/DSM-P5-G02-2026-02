import { AppError } from '../../shared/errors/app-error.js';

export class MLInvalidTextError extends AppError {
  constructor() {
    super({
      code: 'ML_INVALID_TEXT',
      message: 'O texto informado é inválido.',
      statusCode: 400,
    });
  }
}
