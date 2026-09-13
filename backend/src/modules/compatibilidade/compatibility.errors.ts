import { AppError } from '../../shared/errors/app-error.js';

export class ThemeProfileInvalidPeriodError extends AppError {
  constructor() {
    super({
      code: 'THEME_PROFILE_INVALID_PERIOD',
      message: 'Período temático inválido.',
      statusCode: 400,
    });
  }
}

export class CompatibilityInvalidPreferencesError extends AppError {
  constructor() {
    super({
      code: 'COMPATIBILITY_INVALID_PREFERENCES',
      message: 'Preferências temáticas inválidas.',
      statusCode: 400,
    });
  }
}

export class ThemeProfilesNotReadyError extends AppError {
  constructor() {
    super({
      code: 'THEME_PROFILES_NOT_READY',
      message:
        'Perfis temáticos materializados não estão prontos para o escopo.',
      statusCode: 503,
    });
  }
}
