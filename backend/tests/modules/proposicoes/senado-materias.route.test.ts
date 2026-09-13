import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../../src/app.js';
import type { AppConfig } from '../../../src/config/env.js';
import { SenadorNotFoundError } from '../../../src/integrations/senado/senado.errors.js';
import type { SenadoMateriasServiceContract } from '../../../src/modules/proposicoes/senado-materia.types.js';
import type { SenadoMateriaSyncServiceContract } from '../../../src/modules/sync/sync.types.js';

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

const listResponse = {
  data: [
    {
      externalId: 9_048_130,
      source: 'SENADO' as const,
      tipo: 'INS',
      numero: 15,
      ano: 2026,
      ementa: 'Ementa oficial fictícia.',
      descricao: null,
      dataApresentacao: '2026-05-14T00:00:00.000Z',
      situacao: 'INDICAÇÃO ENCAMINHADA',
      uri: 'https://legis.senado.leg.br/dadosabertos/processo/9048130.json',
      urlFonte: null,
      autores: [],
      temasOficiais: [],
      fetchedAt: '2026-09-06T21:00:00.000Z',
    },
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const syncResponse = {
  source: 'SENADO' as const,
  resource: 'MATERIAS' as const,
  status: 'SUCCESS' as const,
  processed: 1,
  inserted: 1,
  updated: 0,
  unchanged: 0,
  errors: [],
};

const apps: Array<ReturnType<typeof buildApp>> = [];

function createApp(
  service: SenadoMateriasServiceContract,
  syncService: SenadoMateriaSyncServiceContract = {
    syncMaterias: () => Promise.resolve(syncResponse),
  },
) {
  const app = buildApp(config, {
    getDatabaseStatus: () => 'connected',
    senadoMateriasService: service,
    senadoMateriaSyncService: syncService,
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe('rotas de matérias do Senado', () => {
  it('lista matérias de um senador com paginação', async () => {
    let received: unknown;
    const service: SenadoMateriasServiceContract = {
      listBySenator: (id, pagination) => {
        received = { id, ...pagination };
        return Promise.resolve(listResponse);
      },
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/api/parlamentares/senadores/5672/proposicoes?page=1&limit=5',
    });

    expect(response.statusCode).toBe(200);
    expect(received).toEqual({ id: 5672, page: 1, limit: 5 });
  });

  it('retorna 404 para parlamentar ausente ou da casa errada', async () => {
    const service: SenadoMateriasServiceContract = {
      listBySenator: () => Promise.reject(new SenadorNotFoundError()),
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/api/parlamentares/senadores/999999/proposicoes',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json<{ error: { code: string } }>().error.code).toBe(
      'SENADOR_NOT_FOUND',
    );
  });

  it.each([
    '/api/parlamentares/senadores/0/proposicoes',
    '/api/parlamentares/senadores/5672/proposicoes?page=0',
    '/api/parlamentares/senadores/5672/proposicoes?limit=101',
  ])('rejeita parâmetros inválidos em %s', async (url) => {
    const service: SenadoMateriasServiceContract = {
      listBySenator: () => Promise.resolve(listResponse),
    };

    const response = await createApp(service).inject({ method: 'GET', url });

    expect(response.statusCode).toBe(400);
  });

  it('dispara sync com escopo controlado', async () => {
    let received: unknown;
    const service: SenadoMateriasServiceContract = {
      listBySenator: () => Promise.resolve(listResponse),
    };
    const syncService: SenadoMateriaSyncServiceContract = {
      syncMaterias: (input) => {
        received = input;
        return Promise.resolve(syncResponse);
      },
    };

    const response = await createApp(service, syncService).inject({
      method: 'POST',
      url: '/api/sync/senado/materias',
      payload: {
        ano: 2026,
        senadorIds: [5672],
        siglas: ['INS'],
        maxMaterias: 3,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(received).toEqual({
      ano: 2026,
      senadorIds: [5672],
      siglas: ['INS'],
      maxMaterias: 3,
    });
  });

  it.each([
    {},
    { ano: 2026, senadorIds: [] },
    { ano: 2026, senadorIds: [5672, 5672] },
    { ano: 2026, senadorIds: [5672], siglas: Array(6).fill('INS') },
    { ano: 2026, senadorIds: [5672], maxMaterias: 0 },
    { ano: 2026, senadorIds: [5672], maxMaterias: 51 },
  ])('rejeita escopo de sync inválido %#', async (payload) => {
    const service: SenadoMateriasServiceContract = {
      listBySenator: () => Promise.resolve(listResponse),
    };

    const response = await createApp(service).inject({
      method: 'POST',
      url: '/api/sync/senado/materias',
      payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it('publica as rotas da fase 7 no OpenAPI', async () => {
    const service: SenadoMateriasServiceContract = {
      listBySenator: () => Promise.resolve(listResponse),
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/docs/json',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      paths: {
        '/api/proposicoes': { get: {} },
        '/api/proposicoes/{id}': { get: {} },
        '/api/parlamentares/senadores/{id}/proposicoes': { get: {} },
        '/api/sync/senado/materias': { post: {} },
      },
    });
  });
});
