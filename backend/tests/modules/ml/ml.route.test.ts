import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../../src/app.js';
import type { AppConfig } from '../../../src/config/env.js';
import { MLUnavailableError } from '../../../src/integrations/ml/ml.errors.js';
import type { MLServiceContract } from '../../../src/modules/ml/ml.types.js';
import { mlHealthFixture, mlPredictionFixture } from '../../fixtures/ml.js';

const config: AppConfig = {
  nodeEnv: 'test',
  port: 3000,
  logLevel: 'silent',
  corsOrigins: [],
  mongodbUri: 'mongodb://example.invalid',
  mongodbDbName: 'pi_parlamentar',
  camaraApiBaseUrl: 'https://dadosabertos.camara.leg.br/api/v2',
  senadoApiBaseUrl: 'https://legis.senado.leg.br/dadosabertos',
  mlServiceUrl: 'http://127.0.0.1:8001',
};

const apps: Array<ReturnType<typeof buildApp>> = [];

function createApp(service: MLServiceContract) {
  const app = buildApp(config, {
    getDatabaseStatus: () => 'connected',
    mlService: service,
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe('rotas de classificação temática', () => {
  it('consulta readiness do serviço ML', async () => {
    const service: MLServiceContract = {
      health: () => Promise.resolve(mlHealthFixture),
      predict: () => Promise.resolve(mlPredictionFixture),
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/api/ml/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(mlHealthFixture);
  });

  it('classifica texto e preserva resposta multi-label', async () => {
    let received: string | undefined;
    const service: MLServiceContract = {
      health: () => Promise.resolve(mlHealthFixture),
      predict: (text) => {
        received = text;
        return Promise.resolve(mlPredictionFixture);
      },
    };

    const response = await createApp(service).inject({
      method: 'POST',
      url: '/api/ml/predict',
      payload: { text: '  Institui campanha nacional de vacinação.  ' },
    });

    expect(response.statusCode).toBe(200);
    expect(received).toBe('  Institui campanha nacional de vacinação.  ');
    expect(response.json()).toEqual(mlPredictionFixture);
  });

  it.each([
    undefined,
    null,
    {},
    { text: null },
    { text: 123 },
    { text: '' },
    { text: '  \n ' },
    { text: 'a'.repeat(5001) },
  ])('rejeita payload inválido %#', async (payload) => {
    const service: MLServiceContract = {
      health: () => Promise.resolve(mlHealthFixture),
      predict: () => Promise.reject(new Error('Não deveria chamar service.')),
    };

    const response = await createApp(service).inject({
      method: 'POST',
      url: '/api/ml/predict',
      ...(payload === undefined ? {} : { payload }),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body) as unknown).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados de entrada inválidos.',
      },
    });
  });

  it('retorna 503 padronizado quando o ML está indisponível', async () => {
    const service: MLServiceContract = {
      health: () => Promise.reject(new MLUnavailableError()),
      predict: () => Promise.reject(new MLUnavailableError()),
    };

    const response = await createApp(service).inject({
      method: 'POST',
      url: '/api/ml/predict',
      payload: { text: 'Texto válido.' },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: {
        code: 'ML_SERVICE_UNAVAILABLE',
        message: 'Serviço de classificação temporariamente indisponível.',
      },
    });
  });

  it('documenta health e predict no OpenAPI sem chamar o ML', async () => {
    const service: MLServiceContract = {
      health: () => Promise.reject(new Error('Não utilizado.')),
      predict: () => Promise.reject(new Error('Não utilizado.')),
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/docs/json',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      paths: {
        '/api/ml/health': { get: {} },
        '/api/ml/predict': { post: {} },
      },
    });
    expect(JSON.stringify(response.json())).toContain('não é probabilidade');
  });
});
