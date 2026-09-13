import { describe, expect, it } from 'vitest';

import { CamaraUnavailableError } from '../../../src/integrations/camara/camara.errors.js';
import type {
  CamaraGateway,
  CamaraListResponse,
  CamaraPagination,
} from '../../../src/integrations/camara/camara.types.js';
import type {
  ParlamentarInput,
  ParlamentarRecord,
  ParlamentarRepositoryContract,
} from '../../../src/modules/parlamentares/parlamentar.types.js';
import { CamaraSyncService } from '../../../src/modules/sync/camara-sync.service.js';
import type {
  FinishSyncLogInput,
  SyncLogRepositoryContract,
} from '../../../src/modules/sync/sync.types.js';
import { camaraDeputadoListItemFixture } from '../../fixtures/camara.js';

class InMemoryParlamentarRepository implements ParlamentarRepositoryContract {
  readonly records = new Map<string, ParlamentarRecord>();

  upsertMany(items: ParlamentarInput[]) {
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const item of items) {
      const key = `${item.source}:${item.externalId}`;
      const existing = this.records.get(key);
      if (existing) {
        const relevantFields = [
          'casa',
          'nome',
          'nomeCivil',
          'partido',
          'uf',
          'fotoUrl',
          'email',
          'situacao',
          'legislatura',
        ] as const;
        const changed = relevantFields.some(
          (field) =>
            field in item &&
            (item[field] ?? null) !== (existing[field] ?? null),
        );
        if (changed) {
          updated += 1;
        } else {
          unchanged += 1;
        }
      } else {
        inserted += 1;
      }
      this.records.set(key, {
        nomeCivil: null,
        situacao: null,
        ...item,
      });
    }

    return Promise.resolve({ inserted, updated, unchanged });
  }

  list() {
    return Promise.resolve({ data: [...this.records.values()], total: 0 });
  }

  findByExternalId() {
    return Promise.resolve(null);
  }
}

class InMemorySyncLogRepository implements SyncLogRepositoryContract {
  readonly started: string[] = [];
  readonly finished: FinishSyncLogInput[] = [];

  start() {
    const id = `sync-${this.started.length + 1}`;
    this.started.push(id);
    return Promise.resolve({ id });
  }

  finish(_id: string, input: FinishSyncLogInput) {
    this.finished.push(input);
    return Promise.resolve();
  }
}

function createGateway(
  listDeputados: (pagination: CamaraPagination) => Promise<CamaraListResponse>,
): CamaraGateway {
  return {
    listDeputados,
    getDeputado: () => Promise.reject(new Error('Não utilizado no sync.')),
  };
}

function pageResponse(page: number, hasNext: boolean): CamaraListResponse {
  return {
    dados: [
      {
        ...camaraDeputadoListItemFixture,
        id: 999_000 + page,
        nome: `Deputada Fictícia ${page}`,
      },
    ],
    links: hasNext
      ? [
          {
            rel: 'next',
            href: `https://dadosabertos.camara.leg.br/api/v2/deputados?pagina=${page + 1}&itens=100`,
          },
        ]
      : [],
  };
}

const clock = () => new Date('2026-09-05T12:00:00.000Z');

describe('CamaraSyncService', () => {
  it('sincroniza todas as páginas e registra sucesso', async () => {
    const requestedPages: number[] = [];
    const gateway = createGateway((pagination) => {
      requestedPages.push(pagination.pagina);
      return Promise.resolve(
        pageResponse(pagination.pagina, pagination.pagina === 1),
      );
    });
    const parlamentares = new InMemoryParlamentarRepository();
    const logs = new InMemorySyncLogRepository();
    const service = new CamaraSyncService(gateway, parlamentares, logs, clock);

    const result = await service.syncDeputados();

    expect(requestedPages).toEqual([1, 2]);
    expect(result).toEqual({
      source: 'CAMARA',
      resource: 'DEPUTADOS',
      status: 'SUCCESS',
      processed: 2,
      inserted: 2,
      updated: 0,
      unchanged: 0,
    });
    expect(parlamentares.records.size).toBe(2);
    expect(logs.finished[0]).toMatchObject({
      status: 'SUCCESS',
      processed: 2,
      inserted: 2,
      updated: 0,
      unchanged: 0,
      errors: [],
    });
  });

  it('executa duas vezes sem duplicação lógica', async () => {
    const gateway = createGateway((pagination) =>
      Promise.resolve(pageResponse(pagination.pagina, false)),
    );
    const parlamentares = new InMemoryParlamentarRepository();
    const logs = new InMemorySyncLogRepository();
    const service = new CamaraSyncService(gateway, parlamentares, logs, clock);

    await service.syncDeputados();
    const second = await service.syncDeputados();

    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(1);
    expect(parlamentares.records.size).toBe(1);
    expect(logs.started).toHaveLength(2);
  });

  it('registra falha sem alterar dados quando a Câmara falha no início', async () => {
    const gateway = createGateway(() =>
      Promise.reject(new CamaraUnavailableError()),
    );
    const parlamentares = new InMemoryParlamentarRepository();
    const logs = new InMemorySyncLogRepository();
    const service = new CamaraSyncService(gateway, parlamentares, logs, clock);

    await expect(service.syncDeputados()).rejects.toBeInstanceOf(
      CamaraUnavailableError,
    );

    expect(parlamentares.records.size).toBe(0);
    expect(logs.finished[0]).toMatchObject({
      status: 'FAILED',
      processed: 0,
      errors: ['Não foi possível consultar a API da Câmara.'],
    });
  });

  it('registra resultado parcial quando uma página posterior falha', async () => {
    const gateway = createGateway((pagination) =>
      pagination.pagina === 1
        ? Promise.resolve(pageResponse(1, true))
        : Promise.reject(new CamaraUnavailableError()),
    );
    const parlamentares = new InMemoryParlamentarRepository();
    const logs = new InMemorySyncLogRepository();
    const service = new CamaraSyncService(gateway, parlamentares, logs, clock);

    await expect(service.syncDeputados()).rejects.toBeInstanceOf(
      CamaraUnavailableError,
    );

    expect(parlamentares.records.size).toBe(1);
    expect(logs.finished[0]).toMatchObject({
      status: 'PARTIAL',
      processed: 1,
      inserted: 1,
      unchanged: 0,
      errors: ['Não foi possível consultar a API da Câmara.'],
    });
  });

  it('registra como processado um lote cuja gravação falhou', async () => {
    const gateway = createGateway((pagination) =>
      Promise.resolve(pageResponse(pagination.pagina, false)),
    );
    const repository: ParlamentarRepositoryContract = {
      upsertMany: () => Promise.reject(new Error('Falha fictícia no bulk.')),
      list: () => Promise.resolve({ data: [], total: 0 }),
      findByExternalId: () => Promise.resolve(null),
    };
    const logs = new InMemorySyncLogRepository();
    const service = new CamaraSyncService(gateway, repository, logs, clock);

    await expect(service.syncDeputados()).rejects.toThrowError(
      'Falha fictícia no bulk.',
    );

    expect(logs.finished[0]).toMatchObject({
      status: 'PARTIAL',
      processed: 1,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      errors: ['Falha interna durante a sincronização.'],
    });
  });

  it('não tenta reclassificar o sync quando a finalização de sucesso falha', async () => {
    const gateway = createGateway((pagination) =>
      Promise.resolve(pageResponse(pagination.pagina, false)),
    );
    const parlamentares = new InMemoryParlamentarRepository();
    const attemptedStatuses: string[] = [];
    const logs: SyncLogRepositoryContract = {
      start: () => Promise.resolve({ id: 'sync-1' }),
      finish: (_id, input) => {
        attemptedStatuses.push(input.status);
        return Promise.reject(new Error('Falha fictícia no sync log.'));
      },
    };
    const service = new CamaraSyncService(gateway, parlamentares, logs, clock);

    await expect(service.syncDeputados()).rejects.toThrowError(
      'Falha fictícia no sync log.',
    );

    expect(attemptedStatuses).toEqual(['SUCCESS']);
  });
});
