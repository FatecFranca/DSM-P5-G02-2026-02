import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../../src/app.js';
import type { AppConfig } from '../../../src/config/env.js';
import { ProposicaoNotFoundError } from '../../../src/integrations/camara/camara.errors.js';
import type { DeputadosServiceContract } from '../../../src/modules/parlamentares/deputados.types.js';
import type {
  ProposicaoListResponse,
  ProposicoesServiceContract,
} from '../../../src/modules/proposicoes/proposicoes.types.js';
import type {
  CamaraSyncServiceContract,
  ProposicaoSyncServiceContract,
} from '../../../src/modules/sync/sync.types.js';

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

const listResponse: ProposicaoListResponse = {
  data: [
    {
      externalId: 2_256_735,
      source: 'CAMARA',
      tipo: 'PL',
      numero: 1234,
      ano: 2025,
      ementa: 'Ementa fictícia',
      descricao: null,
      dataApresentacao: '2025-03-10T10:30:00.000Z',
      situacao: 'Em tramitação',
      uri: 'https://dadosabertos.camara.leg.br/api/v2/proposicoes/2256735',
      urlFonte: null,
      autores: [],
      temasOficiais: [{ codTema: 40, tema: 'Educação' }],
      fetchedAt: '2026-09-05T12:00:00.000Z',
    },
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const deputadosService: DeputadosServiceContract = {
  list: () =>
    Promise.resolve({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }),
  getById: () => Promise.reject(new Error('Não utilizado.')),
};

const deputadoSyncService: CamaraSyncServiceContract = {
  syncDeputados: () =>
    Promise.resolve({
      source: 'CAMARA',
      resource: 'DEPUTADOS',
      status: 'SUCCESS',
      processed: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
    }),
};

const proposicaoSyncService: ProposicaoSyncServiceContract = {
  syncProposicoes: () =>
    Promise.resolve({
      source: 'CAMARA',
      resource: 'PROPOSICOES',
      status: 'SUCCESS',
      processed: 1,
      inserted: 1,
      updated: 0,
      unchanged: 0,
      errors: [],
    }),
};

const apps: Array<ReturnType<typeof buildApp>> = [];

function createApp(service: ProposicoesServiceContract) {
  const app = buildApp(config, {
    getDatabaseStatus: () => 'connected',
    deputadosService,
    camaraSyncService: deputadoSyncService,
    proposicoesService: service,
    proposicaoSyncService,
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe('rotas de proposições', () => {
  it('lista proposições com paginação e filtros', async () => {
    let received: unknown;
    const service: ProposicoesServiceContract = {
      list: (query) => {
        received = query;
        return Promise.resolve(listResponse);
      },
      getById: () => Promise.resolve({ data: listResponse.data[0] }),
      listByParlamentar: () => Promise.resolve(listResponse),
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/api/proposicoes?page=2&limit=5&ano=2025&tipo=PL',
    });

    expect(response.statusCode).toBe(200);
    expect(received).toEqual({ page: 2, limit: 5, ano: 2025, tipo: 'PL' });
    expect(response.json()).toEqual(listResponse);
  });

  it('encaminha source SENADO na listagem e no detalhe', async () => {
    const received: unknown[] = [];
    const senateResponse = {
      ...listResponse,
      data: listResponse.data.map((item) => ({
        ...item,
        source: 'SENADO' as const,
      })),
    };
    const service: ProposicoesServiceContract = {
      list: (query) => {
        received.push(query);
        return Promise.resolve(senateResponse);
      },
      getById: (id, source) => {
        received.push({ id, source });
        return Promise.resolve({ data: senateResponse.data[0] });
      },
      listByParlamentar: () => Promise.resolve(listResponse),
    };
    const app = createApp(service);

    const list = await app.inject({
      method: 'GET',
      url: '/api/proposicoes?source=SENADO&limit=5',
    });
    const detail = await app.inject({
      method: 'GET',
      url: '/api/proposicoes/2256735?source=SENADO',
    });

    expect(list.statusCode).toBe(200);
    expect(detail.statusCode).toBe(200);
    expect(received).toEqual([
      { page: 1, limit: 5, source: 'SENADO' },
      { id: 2_256_735, source: 'SENADO' },
    ]);
    expect(
      list.json<{ data: Array<{ source: string }> }>().data[0]?.source,
    ).toBe('SENADO');
  });

  it('consulta detalhe e retorna 404 padronizado', async () => {
    let found = true;
    const service: ProposicoesServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: () =>
        found
          ? Promise.resolve({ data: listResponse.data[0] })
          : Promise.reject(new ProposicaoNotFoundError()),
      listByParlamentar: () => Promise.resolve(listResponse),
    };
    const app = createApp(service);

    const response = await app.inject({
      method: 'GET',
      url: '/api/proposicoes/2256735',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: listResponse.data[0] });

    found = false;
    const missing = await app.inject({
      method: 'GET',
      url: '/api/proposicoes/9999999',
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({
      error: {
        code: 'PROPOSICAO_NOT_FOUND',
        message: 'Proposição não encontrada.',
      },
    });
  });

  it('lista proposições de um deputado usando somente o serviço local', async () => {
    let received: unknown;
    const service: ProposicoesServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: () => Promise.resolve({ data: listResponse.data[0] }),
      listByParlamentar: (id, pagination) => {
        received = { id, ...pagination };
        return Promise.resolve(listResponse);
      },
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/api/parlamentares/deputados/204379/proposicoes?page=1&limit=20',
    });

    expect(response.statusCode).toBe(200);
    expect(received).toEqual({ id: 204_379, page: 1, limit: 20 });
    expect(response.json()).toEqual(listResponse);
  });

  it('valida paginação e filtros de consulta', async () => {
    const service: ProposicoesServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: () => Promise.resolve({ data: listResponse.data[0] }),
      listByParlamentar: () => Promise.resolve(listResponse),
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/api/proposicoes?limit=101',
    });

    expect(response.statusCode).toBe(400);
  });

  it.each([
    '/api/proposicoes?page=0',
    '/api/proposicoes?limit=0',
    '/api/proposicoes?limit=101',
    '/api/proposicoes?ano=1899',
    '/api/proposicoes?tipo=',
    '/api/proposicoes?source=INVALIDA',
    '/api/proposicoes/0',
    '/api/proposicoes/2256735?source=INVALIDA',
    '/api/parlamentares/deputados/0/proposicoes',
  ])('rejeita parâmetro inválido em %s', async (url) => {
    const service: ProposicoesServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: () => Promise.resolve({ data: listResponse.data[0] }),
      listByParlamentar: () => Promise.resolve(listResponse),
    };

    const response = await createApp(service).inject({ method: 'GET', url });

    expect(response.statusCode).toBe(400);
  });

  it('dispara sincronização com escopo obrigatório e limitado', async () => {
    const service: ProposicoesServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: () => Promise.resolve({ data: listResponse.data[0] }),
      listByParlamentar: () => Promise.resolve(listResponse),
    };

    const response = await createApp(service).inject({
      method: 'POST',
      url: '/api/sync/camara/proposicoes',
      payload: { ano: 2025, deputadoIds: [204_379], maxProposicoes: 10 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      resource: 'PROPOSICOES',
      processed: 1,
      errors: [],
    });
  });

  it('rejeita sincronização ilimitada', async () => {
    const service: ProposicoesServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: () => Promise.resolve({ data: listResponse.data[0] }),
      listByParlamentar: () => Promise.resolve(listResponse),
    };

    const response = await createApp(service).inject({
      method: 'POST',
      url: '/api/sync/camara/proposicoes',
      payload: { ano: 2025, deputadoIds: [], maxProposicoes: 1000 },
    });

    expect(response.statusCode).toBe(400);
  });

  it.each([
    {},
    { ano: 2025, deputadoIds: [] },
    { ano: 2025, deputadoIds: [1, 1] },
    {
      ano: 2025,
      deputadoIds: Array.from({ length: 11 }, (_, index) => index + 1),
    },
    { ano: 2025, deputadoIds: [204_379], maxProposicoes: 0 },
    { ano: 2025, deputadoIds: [204_379], maxProposicoes: 51 },
  ])('rejeita escopo de sincronização inválido %#', async (payload) => {
    const service: ProposicoesServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: () => Promise.resolve({ data: listResponse.data[0] }),
      listByParlamentar: () => Promise.resolve(listResponse),
    };

    const response = await createApp(service).inject({
      method: 'POST',
      url: '/api/sync/camara/proposicoes',
      payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it('publica as quatro rotas da fase 5 no OpenAPI', async () => {
    const service: ProposicoesServiceContract = {
      list: () => Promise.resolve(listResponse),
      getById: () => Promise.resolve({ data: listResponse.data[0] }),
      listByParlamentar: () => Promise.resolve(listResponse),
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
        '/api/parlamentares/deputados/{id}/proposicoes': { get: {} },
        '/api/sync/camara/proposicoes': { post: {} },
      },
    });
  });
});
