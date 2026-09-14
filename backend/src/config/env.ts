const nodeEnvironments = ['development', 'test', 'production'] as const;
const logLevels = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const;

type NodeEnvironment = (typeof nodeEnvironments)[number];
type LogLevel = (typeof logLevels)[number];

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  host: '127.0.0.1';
  port: number;
  logLevel: LogLevel;
  corsOrigins: string[];
  mongodbUri: string;
  mongodbDbName: string;
  camaraApiBaseUrl: string;
  senadoApiBaseUrl: string;
  mlServiceUrl: string;
}

const defaultCorsOrigins = ['http://localhost:5173', 'http://localhost:8081'];

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!nodeEnvironments.includes(nodeEnv as NodeEnvironment)) {
    throw new Error('NODE_ENV inválido.');
  }

  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT deve ser um inteiro entre 1 e 65535.');
  }

  const logLevel = env.LOG_LEVEL ?? 'info';
  if (!logLevels.includes(logLevel as LogLevel)) {
    throw new Error('LOG_LEVEL inválido.');
  }

  const corsOrigins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : defaultCorsOrigins;
  if (
    corsOrigins.some((origin) => {
      if (origin === '*') return true;
      try {
        const url = new URL(origin);
        return (
          !['http:', 'https:'].includes(url.protocol) || url.origin !== origin
        );
      } catch {
        return true;
      }
    })
  ) {
    throw new Error(
      'CORS_ORIGINS deve conter origens HTTP válidas sem wildcard.',
    );
  }

  const mongodbUri = env.MONGODB_URI?.trim();
  if (!mongodbUri) {
    throw new Error('MONGODB_URI é obrigatória.');
  }

  const mongodbDbName = env.MONGODB_DB_NAME?.trim() ?? 'pi_parlamentar';
  if (!mongodbDbName) {
    throw new Error('MONGODB_DB_NAME não pode ser vazio.');
  }

  const camaraApiBaseUrl =
    env.CAMARA_API_BASE_URL?.trim() ??
    'https://dadosabertos.camara.leg.br/api/v2';

  try {
    const url = new URL(camaraApiBaseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error();
    }
  } catch {
    throw new Error('CAMARA_API_BASE_URL deve ser uma URL HTTP válida.');
  }

  const senadoApiBaseUrl =
    env.SENADO_API_BASE_URL?.trim() ??
    'https://legis.senado.leg.br/dadosabertos';

  try {
    const url = new URL(senadoApiBaseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error();
    }
  } catch {
    throw new Error('SENADO_API_BASE_URL deve ser uma URL HTTP válida.');
  }

  const mlServiceUrl = env.ML_SERVICE_URL?.trim() ?? 'http://127.0.0.1:8001';

  try {
    const url = new URL(mlServiceUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error();
    }
  } catch {
    throw new Error('ML_SERVICE_URL deve ser uma URL HTTP válida.');
  }

  return {
    nodeEnv: nodeEnv as NodeEnvironment,
    host: '127.0.0.1',
    port,
    logLevel: logLevel as LogLevel,
    corsOrigins,
    mongodbUri,
    mongodbDbName,
    camaraApiBaseUrl,
    senadoApiBaseUrl,
    mlServiceUrl,
  };
}
