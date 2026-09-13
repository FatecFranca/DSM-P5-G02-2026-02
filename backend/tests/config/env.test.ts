import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config/env.js';

describe('loadConfig', () => {
  it('aplica valores seguros por padrão', () => {
    expect(loadConfig({ MONGODB_URI: 'mongodb://example.invalid' })).toEqual({
      nodeEnv: 'development',
      port: 3000,
      logLevel: 'info',
      corsOrigins: ['http://localhost:5173', 'http://localhost:8081'],
      mongodbUri: 'mongodb://example.invalid',
      mongodbDbName: 'pi_parlamentar',
      camaraApiBaseUrl: 'https://dadosabertos.camara.leg.br/api/v2',
      senadoApiBaseUrl: 'https://legis.senado.leg.br/dadosabertos',
      mlServiceUrl: 'http://127.0.0.1:8001',
    });
  });

  it('normaliza as origens CORS configuradas', () => {
    const config = loadConfig({
      CORS_ORIGINS: ' https://web.exemplo.test,https://mobile.exemplo.test ',
      MONGODB_URI: 'mongodb://example.invalid',
    });

    expect(config.corsOrigins).toEqual([
      'https://web.exemplo.test',
      'https://mobile.exemplo.test',
    ]);
  });

  it('rejeita wildcard em CORS_ORIGINS', () => {
    expect(() =>
      loadConfig({
        CORS_ORIGINS: '*',
        MONGODB_URI: 'mongodb://example.invalid',
      }),
    ).toThrowError(
      'CORS_ORIGINS deve conter origens HTTP válidas sem wildcard.',
    );
  });

  it('rejeita uma porta fora do intervalo válido', () => {
    expect(() =>
      loadConfig({
        PORT: '70000',
        MONGODB_URI: 'mongodb://example.invalid',
      }),
    ).toThrowError('PORT deve ser um inteiro entre 1 e 65535.');
  });

  it('rejeita um nível de log desconhecido', () => {
    expect(() =>
      loadConfig({
        LOG_LEVEL: 'verbose',
        MONGODB_URI: 'mongodb://example.invalid',
      }),
    ).toThrowError('LOG_LEVEL inválido.');
  });

  it('rejeita configuração sem URI do MongoDB', () => {
    expect(() => loadConfig({})).toThrowError('MONGODB_URI é obrigatória.');
  });

  it('rejeita um nome de banco vazio', () => {
    expect(() =>
      loadConfig({
        MONGODB_URI: 'mongodb://example.invalid',
        MONGODB_DB_NAME: '   ',
      }),
    ).toThrowError('MONGODB_DB_NAME não pode ser vazio.');
  });

  it('rejeita uma URL inválida para a API da Câmara', () => {
    expect(() =>
      loadConfig({
        MONGODB_URI: 'mongodb://example.invalid',
        CAMARA_API_BASE_URL: 'endereco-invalido',
      }),
    ).toThrowError('CAMARA_API_BASE_URL deve ser uma URL HTTP válida.');
  });

  it('preserva e valida a URL configurada para a API do Senado', () => {
    expect(
      loadConfig({
        MONGODB_URI: 'mongodb://example.invalid',
        SENADO_API_BASE_URL: 'https://senado.example.test/dadosabertos',
      }).senadoApiBaseUrl,
    ).toBe('https://senado.example.test/dadosabertos');

    expect(() =>
      loadConfig({
        MONGODB_URI: 'mongodb://example.invalid',
        SENADO_API_BASE_URL: 'endereco-invalido',
      }),
    ).toThrowError('SENADO_API_BASE_URL deve ser uma URL HTTP válida.');
  });

  it('preserva e valida a URL configurada para o serviço ML', () => {
    expect(
      loadConfig({
        MONGODB_URI: 'mongodb://example.invalid',
        ML_SERVICE_URL: 'http://ml.example.test:8001',
      }).mlServiceUrl,
    ).toBe('http://ml.example.test:8001');

    expect(() =>
      loadConfig({
        MONGODB_URI: 'mongodb://example.invalid',
        ML_SERVICE_URL: 'file:///tmp/model',
      }),
    ).toThrowError('ML_SERVICE_URL deve ser uma URL HTTP válida.');
  });
});
