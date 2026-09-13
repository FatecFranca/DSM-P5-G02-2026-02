import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../../src/app.js';
import type { AppConfig } from '../../../src/config/env.js';
import { DeputadoNotFoundError } from '../../../src/integrations/camara/camara.errors.js';
import type {
  DeputadoDetailResponse,
  DeputadoListResponse,
  DeputadosServiceContract,
} from '../../../src/modules/parlamentares/deputados.types.js';
import type { CamaraSyncServiceContract } from '../../../src/modules/sync/sync.types.js';

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

const listResponse: DeputadoListResponse = {
  data: [
    {
      externalId: 999_001,
      nome: 'Deputada Fictícia',
      partido: 'ABC',
      uf: 'SP',
      fotoUrl: null,
      email: null,
    },
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const detailResponse: DeputadoDetailResponse = {
  data: {
    externalId: 999_001,
    source: 'CAMARA',
    nome: 'Deputada Fictícia',
    nomeCivil: null,
    partido: 'ABC',
    uf: 'SP',
    casa: 'CAMARA',
    fotoUrl: null,
    email: null,
    situacao: 'Exercício',
  },
};

const apps: Array<ReturnType<typeof buildApp>> = [];

const syncService: CamaraSyncServiceContract = {
  syncDeputados: () =>
    Promise.resolve({
      source: 'CAMARA',
      resource: 'DEPUTADOS',
      status: 'SUCCESS',
      processed: 2,
      inserted: 2,
      updated: 0,
      unchanged: 0,
    }),
};

function createApp(
  deputadosService: DeputadosServiceContract,
  camaraSyncService: CamaraSyncServiceContract = syncService,
) {
  const app = buildApp(config, {
    getDatabaseStatus: () => 'connected',
    deputadosService,
    camaraSyncService,
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe('rotas de deputados', () => {
  it('usa a paginação padrão na listagem', async () => {
    let receivedPagination: { page: number; limit: number } | undefined;
    const service: DeputadosServiceContract = {
      list: (pagination) => {
        receivedPagination = pagination;
        return Promise.resolve(listResponse);
      },
      getById: () => Promise.resolve(detailResponse),
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/api/parlamentares/deputados',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(listResponse);
    expect(receivedPagination).toEqual({ page: 1, limit: 20 });
  });

  it('aceita paginação válida informada pelo consumidor', async () => {
    let receivedPagination: { page: number; limit: number } | undefined;
    const service: DeputadosServiceContract = {
      list: (pagination) => {
        receivedPagination = pagination;
        return Promise.resolve({
          ...listResponse,
          pagination: {
            ...pagination,
            total: 1,
            totalPages: 1,
          },
        });
      },
      getById: () => Promise.resolve(detailResponse),
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/api/parlamentares/deputados?page=2&limit=5',
    });

    expect(response.statusCode).toBe(200);
    expect(receivedPagination).toEqual({ page: 2, limit: 5 });
  });

  it.each([
    '/api/parlamentares/deputados?page=0',
    '/api/parlamentares/deputados?limit=101',
    '/api/parlamentares/deputados?page=texto',
  ])('rejeita paginação inválida em %s', async (url) => {
    const service: DeputadosServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: () => Promise.resolve(detailResponse),
    };

    const response = await createApp(service).inject({ method: 'GET', url });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados de entrada inválidos.',
      },
    });
  });

  it('consulta um deputado por ID', async () => {
    let receivedId: number | undefined;
    const service: DeputadosServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: (id) => {
        receivedId = id;
        return Promise.resolve(detailResponse);
      },
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/api/parlamentares/deputados/999001',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(detailResponse);
    expect(receivedId).toBe(999_001);
  });

  it('retorna erro padronizado quando o deputado não existe', async () => {
    const service: DeputadosServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: () => Promise.reject(new DeputadoNotFoundError()),
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/api/parlamentares/deputados/999999',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'DEPUTADO_NOT_FOUND',
        message: 'Deputado não encontrado.',
      },
    });
  });

  it('dispara a sincronização de deputados da Câmara', async () => {
    let syncWasStarted = false;
    const service: DeputadosServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: () => Promise.resolve(detailResponse),
    };
    const camaraSyncService: CamaraSyncServiceContract = {
      syncDeputados: () => {
        syncWasStarted = true;
        return Promise.resolve({
          source: 'CAMARA',
          resource: 'DEPUTADOS',
          status: 'SUCCESS',
          processed: 2,
          inserted: 2,
          updated: 0,
          unchanged: 0,
        });
      },
    };

    const response = await createApp(service, camaraSyncService).inject({
      method: 'POST',
      url: '/api/sync/camara/deputados',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      source: 'CAMARA',
      resource: 'DEPUTADOS',
      status: 'SUCCESS',
      processed: 2,
      inserted: 2,
      updated: 0,
      unchanged: 0,
    });
    expect(syncWasStarted).toBe(true);
  });
});
