import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../../src/app.js';
import type { AppConfig } from '../../../src/config/env.js';
import { DeputadoNotFoundError } from '../../../src/integrations/camara/camara.errors.js';
import type { ParlamentarStatsServiceContract } from '../../../src/modules/indicadores/parlamentar-stats.types.js';
import type { ParlamentarIndicadoresServiceContract } from '../../../src/modules/indicadores/parlamentar-indicadores.types.js';
import type {
  CamaraIndicadorSyncServiceContract,
  SenadoIndicadorSyncServiceContract,
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

const statsResponse = {
  parlamentar: { externalId: 204_379, source: 'CAMARA' as const },
  periodo: { inicio: '2026-06-01', fim: '2026-06-30' },
  estatisticas: {
    proposicoes: 3,
    votacoes: 4,
    comissoesOrgaos: 2,
    temasDistintos: 2,
  },
  temas: [{ codTema: 40, tema: 'Educação', quantidade: 2 }],
};

const syncResponse = {
  source: 'CAMARA' as const,
  resource: 'INDICADORES' as const,
  status: 'SUCCESS' as const,
  processed: 3,
  inserted: 3,
  updated: 0,
  unchanged: 0,
  errors: [],
};

const apps: Array<ReturnType<typeof buildApp>> = [];

function createApp(
  statsService: ParlamentarStatsServiceContract,
  camaraSync: CamaraIndicadorSyncServiceContract = {
    syncIndicadores: () => Promise.resolve(syncResponse),
  },
  senadoSync: SenadoIndicadorSyncServiceContract = {
    syncIndicadores: () =>
      Promise.resolve({ ...syncResponse, source: 'SENADO' }),
  },
  queryService: ParlamentarIndicadoresServiceContract = {
    listVotacoes: () =>
      Promise.resolve({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    listOrgaos: () =>
      Promise.resolve({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
  },
) {
  const app = buildApp(config, {
    getDatabaseStatus: () => 'connected',
    parlamentarStatsService: statsService,
    camaraIndicadorSyncService: camaraSync,
    senadoIndicadorSyncService: senadoSync,
    parlamentarIndicadoresService: queryService,
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe('rotas de indicadores parlamentares', () => {
  it.each([
    ['/api/parlamentares/deputados/204379/estatisticas', 'CAMARA', 204_379],
    ['/api/parlamentares/senadores/5672/estatisticas', 'SENADO', 5672],
  ] as const)('retorna estatísticas em %s', async (path, source, id) => {
    let received: unknown;
    const service: ParlamentarStatsServiceContract = {
      getStats: (receivedSource, receivedId, period) => {
        received = { source: receivedSource, id: receivedId, ...period };
        return Promise.resolve({
          ...statsResponse,
          parlamentar: { externalId: receivedId, source: receivedSource },
        });
      },
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: `${path}?dataInicio=2026-06-01&dataFim=2026-06-30`,
    });

    expect(response.statusCode).toBe(200);
    expect(received).toEqual({
      source,
      id,
      dataInicio: '2026-06-01',
      dataFim: '2026-06-30',
    });
    expect(response.json()).not.toHaveProperty('scoreQualidade');
  });

  it('retorna 404 para parlamentar ausente ou da casa errada', async () => {
    const service: ParlamentarStatsServiceContract = {
      getStats: () => Promise.reject(new DeputadoNotFoundError()),
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/api/parlamentares/deputados/999999/estatisticas?dataInicio=2026-06-01&dataFim=2026-06-30',
    });

    expect(response.statusCode).toBe(404);
  });

  it.each([
    ['/api/parlamentares/deputados/204379/votacoes', 'votacoes'],
    ['/api/parlamentares/senadores/5672/orgaos', 'orgaos'],
  ] as const)('lista %s persistidos com paginação', async (path, resource) => {
    const statsService: ParlamentarStatsServiceContract = {
      getStats: () => Promise.resolve(statsResponse),
    };
    const queryService: ParlamentarIndicadoresServiceContract = {
      listVotacoes: () =>
        Promise.resolve({
          data: [
            {
              votacaoExternalId: '7102',
              data: '2026-08-12T00:00:00.000Z',
              voto: 'Sim',
              descricao: null,
              resultado: 'A',
              casa: 'SF',
              proposicaoExternalId: 9_095_355,
            },
          ],
          pagination: { page: 1, limit: 5, total: 1, totalPages: 1 },
        }),
      listOrgaos: () =>
        Promise.resolve({
          data: [
            {
              orgaoExternalId: 38,
              sigla: 'CAE',
              nome: 'Comissão de Assuntos Econômicos',
              casa: 'SF',
              funcao: 'Titular',
              inicio: '2025-11-26T00:00:00.000Z',
              fim: null,
            },
          ],
          pagination: { page: 1, limit: 5, total: 1, totalPages: 1 },
        }),
    };

    const response = await createApp(
      statsService,
      undefined,
      undefined,
      queryService,
    ).inject({
      method: 'GET',
      url: `${path}?dataInicio=2026-06-01&dataFim=2026-06-30&limit=5`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ data: unknown[] }>().data).toHaveLength(1);
    expect(resource).toBeTruthy();
  });

  it.each([
    '/api/parlamentares/deputados/0/estatisticas?dataInicio=2026-06-01&dataFim=2026-06-30',
    '/api/parlamentares/deputados/204379/estatisticas',
    '/api/parlamentares/deputados/204379/estatisticas?dataInicio=01-06-2026&dataFim=2026-06-30',
  ])('rejeita parâmetros inválidos em %s', async (url) => {
    const service: ParlamentarStatsServiceContract = {
      getStats: () => Promise.resolve(statsResponse),
    };

    const response = await createApp(service).inject({ method: 'GET', url });

    expect(response.statusCode).toBe(400);
  });

  it('dispara os syncs controlados das duas Casas', async () => {
    const received: unknown[] = [];
    const statsService: ParlamentarStatsServiceContract = {
      getStats: () => Promise.resolve(statsResponse),
    };
    const camaraSync: CamaraIndicadorSyncServiceContract = {
      syncIndicadores: (input) => {
        received.push({ source: 'CAMARA', ...input });
        return Promise.resolve(syncResponse);
      },
    };
    const senadoSync: SenadoIndicadorSyncServiceContract = {
      syncIndicadores: (input) => {
        received.push({ source: 'SENADO', ...input });
        return Promise.resolve({ ...syncResponse, source: 'SENADO' });
      },
    };
    const app = createApp(statsService, camaraSync, senadoSync);
    const payload = {
      parlamentarExternalId: 204_379,
      dataInicio: '2026-06-17',
      dataFim: '2026-06-17',
      maxVotacoes: 5,
      maxOrgaos: 5,
    };

    const camara = await app.inject({
      method: 'POST',
      url: '/api/sync/camara/indicadores',
      payload: { ...payload, orgaoId: 180 },
    });
    const senado = await app.inject({
      method: 'POST',
      url: '/api/sync/senado/indicadores',
      payload: { ...payload, parlamentarExternalId: 5672 },
    });

    expect(camara.statusCode).toBe(200);
    expect(senado.statusCode).toBe(200);
    expect(received).toEqual([
      { source: 'CAMARA', ...payload, orgaoId: 180 },
      { source: 'SENADO', ...payload, parlamentarExternalId: 5672 },
    ]);
  });

  it.each([
    {},
    {
      parlamentarExternalId: 0,
      dataInicio: '2026-06-01',
      dataFim: '2026-06-30',
    },
    { parlamentarExternalId: 1, dataInicio: 'inválida', dataFim: '2026-06-30' },
    {
      parlamentarExternalId: 1,
      dataInicio: '2026-06-01',
      dataFim: '2026-06-30',
      maxVotacoes: 11,
    },
    {
      parlamentarExternalId: 1,
      dataInicio: '2026-06-01',
      dataFim: '2026-06-30',
      maxOrgaos: 21,
    },
  ])('rejeita escopo de sync inválido %#', async (payload) => {
    const service: ParlamentarStatsServiceContract = {
      getStats: () => Promise.resolve(statsResponse),
    };

    const response = await createApp(service).inject({
      method: 'POST',
      url: '/api/sync/camara/indicadores',
      payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it('publica as rotas da fase 8 no OpenAPI', async () => {
    const service: ParlamentarStatsServiceContract = {
      getStats: () => Promise.resolve(statsResponse),
    };

    const response = await createApp(service).inject({
      method: 'GET',
      url: '/docs/json',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      paths: {
        '/api/parlamentares/deputados/{id}/estatisticas': { get: {} },
        '/api/parlamentares/senadores/{id}/estatisticas': { get: {} },
        '/api/parlamentares/deputados/{id}/votacoes': { get: {} },
        '/api/parlamentares/deputados/{id}/orgaos': { get: {} },
        '/api/parlamentares/senadores/{id}/votacoes': { get: {} },
        '/api/parlamentares/senadores/{id}/orgaos': { get: {} },
        '/api/sync/camara/indicadores': { post: {} },
        '/api/sync/senado/indicadores': { post: {} },
      },
    });
  });
});
