import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../../src/app.js';
import type { AppConfig } from '../../../src/config/env.js';
import type { CompatibilityServiceContract } from '../../../src/modules/compatibilidade/compatibility.types.js';
import { ThemeProfilesNotReadyError } from '../../../src/modules/compatibilidade/compatibility.errors.js';
import type { ThemeProfileServiceContract } from '../../../src/modules/compatibilidade/theme-profile.types.js';

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

const profile = {
  parliamentarian: {
    id: 123,
    name: 'Deputada Exemplo',
    party: 'ABC',
    uf: 'SP',
  },
  source: 'CAMARA' as const,
  period: { startYear: 2023, endYear: 2025 },
  themeSource: 'enriched' as const,
  documentsAnalyzed: 3,
  documentsWithThemes: 2,
  documentsWithOfficialThemes: 2,
  documentsWithMLThemes: 0,
  documentsWithoutThemes: 1,
  coverage: 2 / 3,
  officialCoverage: 2 / 3,
  enrichedCoverage: 2 / 3,
  themes: [{ code: 46, name: 'Educação', documentCount: 2, share: 1 }],
};

const compatibility = {
  source: 'CAMARA' as const,
  period: { startYear: 2023, endYear: 2025 },
  themeSource: 'enriched' as const,
  method: 'cosine_similarity' as const,
  results: [
    {
      position: 1,
      parliamentarian: profile.parliamentarian,
      compatibility: 1,
      compatibilityPercent: 100,
      documentsAnalyzed: 3,
      coverage: 2 / 3,
      matchedThemes: [
        {
          code: 46,
          name: 'Educação',
          userWeight: 5,
          parliamentarianShare: 1,
        },
      ],
      evidence: [],
    },
  ],
  summary: {
    parliamentariansConsidered: 2,
    profilesCompared: 1,
    profilesExcludedWithoutThemes: 1,
    documentsAnalyzed: 3,
    documentsWithThemes: 2,
    documentsWithOfficialThemes: 2,
    documentsWithMLThemes: 0,
    coverage: 2 / 3,
    officialCoverage: 2 / 3,
    enrichedCoverage: 2 / 3,
    themesObserved: 1,
  },
};

const apps: Array<ReturnType<typeof buildApp>> = [];

function createApp(
  overrides: {
    profileService?: ThemeProfileServiceContract;
    compatibilityService?: CompatibilityServiceContract;
  } = {},
) {
  const profileService: ThemeProfileServiceContract =
    overrides.profileService ?? {
      getProfile: () => Promise.resolve(profile),
    };
  const compatibilityService: CompatibilityServiceContract =
    overrides.compatibilityService ?? {
      rank: () => Promise.resolve(compatibility),
    };
  const app = buildApp(config, {
    getDatabaseStatus: () => 'connected',
    themeProfileService: profileService,
    compatibilityService,
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe('rotas de perfil e compatibilidade temática', () => {
  it('encaminha themeSource para consultar perfil oficial ou enriquecido', async () => {
    let received: unknown;
    const profileService: ThemeProfileServiceContract = {
      getProfile: (id, period, themeSource) => {
        received = { id, period, themeSource };
        return Promise.resolve({
          ...profile,
          themeSource: 'official',
          documentsWithOfficialThemes: 2,
          documentsWithMLThemes: 0,
          officialCoverage: 2 / 3,
          enrichedCoverage: 2 / 3,
        });
      },
    };

    const response = await createApp({ profileService }).inject({
      method: 'GET',
      url: '/api/parlamentares/deputados/123/perfil-tematico?startYear=2023&endYear=2025&themeSource=official',
    });

    expect(response.statusCode).toBe(200);
    expect(received).toEqual({
      id: 123,
      period: { startYear: 2023, endYear: 2025 },
      themeSource: 'official',
    });
    expect(response.json()).toMatchObject({
      themeSource: 'official',
      officialCoverage: 2 / 3,
      enrichedCoverage: 2 / 3,
    });
  });

  it('lista os 32 temas suportados da Câmara', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/api/temas?source=CAMARA',
    });

    const body = response.json<{ themes: unknown[] }>();
    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({ source: 'CAMARA', count: 32 });
    expect(body.themes).toHaveLength(32);
  });

  it('consulta perfil individual com período padrão', async () => {
    let received: unknown;
    const profileService: ThemeProfileServiceContract = {
      getProfile: (id, period) => {
        received = { id, period };
        return Promise.resolve(profile);
      },
    };

    const response = await createApp({ profileService }).inject({
      method: 'GET',
      url: '/api/parlamentares/deputados/123/perfil-tematico',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(profile);
    expect(received).toEqual({ id: 123, period: undefined });
  });

  it('calcula ranking e encaminha preferências sem persistência', async () => {
    let received: unknown;
    const compatibilityService: CompatibilityServiceContract = {
      rank: (request) => {
        received = request;
        return Promise.resolve(compatibility);
      },
    };
    const payload = {
      source: 'CAMARA',
      period: { startYear: 2023, endYear: 2025 },
      preferences: [{ themeCode: 46, weight: 5 }],
      limit: 5,
    };

    const response = await createApp({ compatibilityService }).inject({
      method: 'POST',
      url: '/api/compatibilidade',
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(compatibility);
    expect(received).toEqual(payload);
  });

  it.each([
    {},
    { source: 'SENADO', preferences: [{ themeCode: 46, weight: 5 }] },
    { source: 'CAMARA', preferences: [] },
    { source: 'CAMARA', preferences: [{ themeCode: 999, weight: 5 }] },
    { source: 'CAMARA', preferences: [{ themeCode: 46, weight: 0 }] },
    { source: 'CAMARA', preferences: [{ themeCode: 46, weight: 6 }] },
    { source: 'CAMARA', preferences: [{ themeCode: 46, weight: 1.5 }] },
    {
      source: 'CAMARA',
      period: { startYear: '2023', endYear: '2025' },
      preferences: [{ themeCode: '46', weight: '5' }],
      limit: '5',
    },
    {
      source: 'CAMARA',
      period: { startYear: 2025, endYear: 2023 },
      preferences: [{ themeCode: 46, weight: 5 }],
    },
    {
      source: 'CAMARA',
      preferences: [{ themeCode: 46, weight: 5 }],
      limit: 21,
    },
  ])('rejeita request inválido %#', async (payload) => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/api/compatibilidade',
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados de entrada inválidos.',
      },
    });
  });

  it('documenta fórmula, interpretação e três rotas no OpenAPI', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/docs/json',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      paths: {
        '/api/temas': { get: {} },
        '/api/parlamentares/deputados/{id}/perfil-tematico': { get: {} },
        '/api/compatibilidade': { post: {} },
      },
    });
    const document = response.json<{
      paths: {
        '/api/compatibilidade': {
          post: { responses: Record<string, unknown> };
        };
      };
    }>();
    const openapi = JSON.stringify(document);
    expect(openapi).toContain('similaridade de cosseno');
    expect(openapi).toContain('não é probabilidade');
    expect(openapi).toContain('themeSource');
    expect(openapi).toContain('themeOrigin');
    expect(
      document.paths['/api/compatibilidade'].post.responses,
    ).toHaveProperty('503');
  });

  it('retorna erro operacional claro quando os perfis não estão prontos', async () => {
    const app = createApp({
      compatibilityService: {
        rank: () => Promise.reject(new ThemeProfilesNotReadyError()),
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/compatibilidade',
      payload: {
        source: 'CAMARA',
        preferences: [{ themeCode: 46, weight: 5 }],
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: {
        code: 'THEME_PROFILES_NOT_READY',
        message:
          'Perfis temáticos materializados não estão prontos para o escopo.',
      },
    });
  });
});
