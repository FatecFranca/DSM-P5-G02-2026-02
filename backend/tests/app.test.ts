import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import type { AppConfig } from '../src/config/env.js';

const config: AppConfig = {
  nodeEnv: 'test',
  port: 3000,
  logLevel: 'silent',
  corsOrigins: ['http://localhost:5173'],
  mongodbUri: 'mongodb://example.invalid',
  mongodbDbName: 'pi_parlamentar',
  camaraApiBaseUrl: 'https://dadosabertos.camara.leg.br/api/v2',
  senadoApiBaseUrl: 'https://legis.senado.leg.br/dadosabertos',
  mlServiceUrl: 'http://127.0.0.1:8001',
};

const apps: Array<ReturnType<typeof buildApp>> = [];

function createApp(databaseStatus: 'connected' | 'disconnected' = 'connected') {
  const app = buildApp(config, {
    getDatabaseStatus: () => databaseStatus,
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe('aplicação HTTP', () => {
  it('informa que a API e o banco estão disponíveis', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      database: 'connected',
    });
  });

  it('informa estado degradado quando o banco está desconectado', async () => {
    const response = await createApp('disconnected').inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'degraded',
      database: 'disconnected',
    });
  });

  it('publica o contrato do health na documentação OpenAPI', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/docs/json',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      openapi: '3.0.3',
      paths: {
        '/health': {
          get: {},
        },
      },
    });
  });

  it('organiza e exemplifica todas as operações públicas no OpenAPI', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/docs/json',
    });
    const document = response.json<{
      tags: Array<{ name: string; description: string }>;
      paths: Record<
        string,
        Record<
          string,
          {
            description?: string;
            requestBody?: unknown;
            responses?: unknown;
          }
        >
      >;
    }>();

    expect(document.tags.map(({ name }) => name)).toEqual([
      'Health',
      'Parlamentares',
      'Proposições',
      'Indicadores',
      'Temas',
      'Compatibilidade',
      'Machine Learning',
      'Sincronização',
    ]);
    for (const pathItem of Object.values(document.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method))
          continue;
        expect(operation.description).toEqual(expect.any(String));
        expect(operation.description).not.toHaveLength(0);
      }
    }

    const serializedDocument = JSON.stringify(document);
    expect(serializedDocument).toContain('"example":{"code":46');
    expect(serializedDocument).toContain('"externalId":204379');
    expect(serializedDocument).toContain('"documentsAnalyzed":12');
    expect(serializedDocument).toContain('"preferences":[{"themeCode":46');
  });

  it('autoriza uma origem CORS configurada', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:5173' },
    });

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
  });

  it('não autoriza uma origem CORS não configurada', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://origem-nao-permitida.test' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('retorna erro padronizado para uma rota inexistente', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/rota-inexistente',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Rota não encontrada.',
      },
    });
  });

  it('preserva erros HTTP de body no contrato padronizado', async () => {
    const malformed = await createApp().inject({
      method: 'POST',
      url: '/api/compatibilidade',
      headers: { 'content-type': 'application/json' },
      payload: '{',
    });
    const unsupported = await createApp().inject({
      method: 'POST',
      url: '/api/compatibilidade',
      headers: { 'content-type': 'application/xml' },
      payload: '<request />',
    });
    const oversized = await createApp().inject({
      method: 'POST',
      url: '/api/ml/predict',
      payload: { text: 'x'.repeat(1_048_576) },
    });

    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados de entrada inválidos.',
      },
    });
    expect(unsupported.statusCode).toBe(415);
    expect(unsupported.json()).toEqual({
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Tipo de conteúdo não suportado.',
      },
    });
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json()).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Corpo da requisição excede o limite permitido.',
      },
    });
  });

  it('rejeita propriedades não declaradas em vez de removê-las', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/api/temas?source=CAMARA&internal=true',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
  });
});
