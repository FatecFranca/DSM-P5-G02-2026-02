import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../../src/app.js';
import type { AppConfig } from '../../../src/config/env.js';
import {
  SenadorNotFoundError,
  SenadoUnavailableError,
} from '../../../src/integrations/senado/senado.errors.js';
import type {
  SenadorDetailResponse,
  SenadorListResponse,
  SenadoresServiceContract,
} from '../../../src/modules/parlamentares/senadores.types.js';
import type { SenadoSyncServiceContract } from '../../../src/modules/sync/sync.types.js';

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

const listResponse: SenadorListResponse = {
  data: [
    {
      externalId: 5672,
      nome: 'Senadora Fictícia',
      partido: 'ABC',
      uf: 'AC',
      fotoUrl: null,
      email: null,
    },
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const detailResponse: SenadorDetailResponse = {
  data: {
    externalId: 5672,
    source: 'SENADO',
    nome: 'Senadora Fictícia',
    nomeCivil: 'NOME COMPLETO FICTÍCIO',
    partido: 'ABC',
    uf: 'AC',
    casa: 'SENADO',
    fotoUrl: null,
    email: null,
    situacao: 'Titular',
  },
};

const syncResponse = {
  source: 'SENADO' as const,
  resource: 'SENADORES' as const,
  status: 'SUCCESS' as const,
  processed: 81,
  inserted: 81,
  updated: 0,
  unchanged: 0,
  errors: [],
};

const apps: Array<ReturnType<typeof buildApp>> = [];

function createApp(
  service: SenadoresServiceContract,
  syncService: SenadoSyncServiceContract = {
    syncSenators: () => Promise.resolve(syncResponse),
  },
) {
  const app = buildApp(config, {
    getDatabaseStatus: () => 'connected',
    senadoresService: service,
    senadoSyncService: syncService,
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe('rotas de senadores', () => {
  it('lista senadores com paginação padrão', async () => {
    let received: unknown;
    const service: SenadoresServiceContract = {
      list: (pagination) => {
        received = pagination;
        return Promise.resolve(listResponse);
      },
      getById: () => Promise.resolve(detailResponse),
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/api/parlamentares/senadores',
    });

    expect(response.statusCode).toBe(200);
    expect(received).toEqual({ page: 1, limit: 20 });
    expect(response.json()).toEqual(listResponse);
  });

  it('aceita paginação válida', async () => {
    let received: unknown;
    const service: SenadoresServiceContract = {
      list: (pagination) => {
        received = pagination;
        return Promise.resolve({
          ...listResponse,
          pagination: { ...pagination, total: 1, totalPages: 1 },
        });
      },
      getById: () => Promise.resolve(detailResponse),
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/api/parlamentares/senadores?page=2&limit=5',
    });

    expect(response.statusCode).toBe(200);
    expect(received).toEqual({ page: 2, limit: 5 });
  });

  it.each([
    '/api/parlamentares/senadores?page=0',
    '/api/parlamentares/senadores?limit=0',
    '/api/parlamentares/senadores?limit=101',
    '/api/parlamentares/senadores?page=texto',
    '/api/parlamentares/senadores/0',
  ])('rejeita parâmetro inválido em %s', async (url) => {
    const service: SenadoresServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: () => Promise.resolve(detailResponse),
    };

    const response = await createApp(service).inject({ method: 'GET', url });

    expect(response.statusCode).toBe(400);
  });

  it('consulta um senador por ID', async () => {
    let received: number | undefined;
    const service: SenadoresServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: (id) => {
        received = id;
        return Promise.resolve(detailResponse);
      },
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/api/parlamentares/senadores/5672',
    });

    expect(response.statusCode).toBe(200);
    expect(received).toBe(5672);
    expect(response.json()).toEqual(detailResponse);
  });

  it('retorna 404 padronizado para senador ausente', async () => {
    const service: SenadoresServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: () => Promise.reject(new SenadorNotFoundError()),
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/api/parlamentares/senadores/999999',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'SENADOR_NOT_FOUND',
        message: 'Senador não encontrado.',
      },
    });
  });

  it('dispara a sincronização do Senado e traduz falha externa', async () => {
    const service: SenadoresServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: () => Promise.resolve(detailResponse),
    };
    let fail = false;
    const syncService: SenadoSyncServiceContract = {
      syncSenators: () =>
        fail
          ? Promise.reject(new SenadoUnavailableError())
          : Promise.resolve(syncResponse),
    };
    const app = createApp(service, syncService);

    const success = await app.inject({
      method: 'POST',
      url: '/api/sync/senado/senadores',
    });
    fail = true;
    const failure = await app.inject({
      method: 'POST',
      url: '/api/sync/senado/senadores',
    });

    expect(success.statusCode).toBe(200);
    expect(success.json()).toEqual(syncResponse);
    expect(failure.statusCode).toBe(502);
    expect(failure.json()).toEqual({
      error: {
        code: 'SENADO_UNAVAILABLE',
        message: 'Não foi possível consultar a API do Senado.',
      },
    });
  });

  it('publica as rotas da fase 6 no OpenAPI', async () => {
    const service: SenadoresServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: () => Promise.resolve(detailResponse),
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/docs/json',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      paths: {
        '/api/parlamentares/senadores': { get: {} },
        '/api/parlamentares/senadores/{id}': { get: {} },
        '/api/sync/senado/senadores': { post: {} },
      },
    });
  });
});
