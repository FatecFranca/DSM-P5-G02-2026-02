import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../../src/app.js';
import type { AppConfig } from '../../../src/config/env.js';

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
  syncApiToken: 'test-sync-token',
  rateLimit: {
    globalMax: 100,
    timeWindowMs: 60_000,
    mlPredictMax: 10,
    compatibilityMax: 10,
    syncMax: 5,
  },
  trustedProxyAddresses: ['127.0.0.1'],
};

const apps: Array<ReturnType<typeof buildApp>> = [];

function createApp() {
  const app = buildApp(config, {
    getDatabaseStatus: () => 'connected',
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

interface ThemePayload {
  code: number;
  name: string;
  description: string;
  examples: string[];
}

describe('rotas de temas', () => {
  it('lista os 32 temas com explicações em linguagem cidadã', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/api/temas?source=CAMARA',
    });

    expect(response.statusCode).toBe(200);
    const body: {
      source: string;
      count: number;
      themes: ThemePayload[];
    } = response.json();
    expect(body.source).toBe('CAMARA');
    expect(body.count).toBe(32);
    expect(body.themes).toHaveLength(32);
    for (const theme of body.themes) {
      expect(theme.code).toBeGreaterThan(0);
      expect(theme.name.length).toBeGreaterThan(0);
      expect(theme.description.length).toBeGreaterThan(0);
      expect(theme.examples).toHaveLength(3);
      expect(theme.examples.every((example) => example.length > 0)).toBe(true);
    }
    expect(new Set(body.themes.map(({ code }) => code)).size).toBe(32);
  });

  it('explica o tema 35 sem remover a taxonomia oficial', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/api/temas?source=CAMARA',
    });

    expect(response.statusCode).toBe(200);
    const { themes }: { themes: ThemePayload[] } = response.json();
    const theme = themes.find(({ code }) => code === 35);
    expect(theme?.name).toBe('Arte, Cultura e Religião');
    expect(theme?.description.length).toBeGreaterThan(0);
    expect(theme?.examples).toHaveLength(3);
    expect(themes.find(({ code }) => code === 40)?.name).toBe('Economia');
    expect(themes.find(({ code }) => code === 46)?.name).toBe('Educação');
  });
});
