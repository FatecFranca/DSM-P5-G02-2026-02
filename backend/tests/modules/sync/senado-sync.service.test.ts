import { describe, expect, it } from 'vitest';

import { SenadoUnavailableError } from '../../../src/integrations/senado/senado.errors.js';
import { senadoCurrentSenatorSchema } from '../../../src/integrations/senado/senado.schemas.js';
import type { SenadoGateway } from '../../../src/integrations/senado/senado.types.js';
import { classifyParlamentares } from '../../../src/modules/parlamentares/parlamentar.repository.js';
import type {
  ParlamentarInput,
  ParlamentarRecord,
  ParlamentarRepositoryContract,
} from '../../../src/modules/parlamentares/parlamentar.types.js';
import { SenadoSyncService } from '../../../src/modules/sync/senado-sync.service.js';
import type {
  FinishSyncLogInput,
  StartSyncLogInput,
  SyncLogRepositoryContract,
} from '../../../src/modules/sync/sync.types.js';
import { senadoCurrentSenatorFixture } from '../../fixtures/senado.js';

class InMemoryParlamentares implements ParlamentarRepositoryContract {
  readonly records = new Map<string, ParlamentarRecord>();

  upsertMany(items: ParlamentarInput[]) {
    const classified = classifyParlamentares(items, [...this.records.values()]);
    for (const item of items) {
      this.records.set(`${item.source}:${item.externalId}`, {
        ...item,
        nomeCivil: item.nomeCivil ?? null,
        situacao: item.situacao ?? null,
      });
    }
    return Promise.resolve({
      inserted: classified.filter(({ state }) => state === 'INSERTED').length,
      updated: classified.filter(({ state }) => state === 'UPDATED').length,
      unchanged: classified.filter(({ state }) => state === 'UNCHANGED').length,
    });
  }

  list() {
    return Promise.resolve({
      data: [...this.records.values()],
      total: this.records.size,
    });
  }

  findByExternalId() {
    return Promise.resolve(null);
  }
}

class InMemoryLogs implements SyncLogRepositoryContract {
  readonly started: StartSyncLogInput[] = [];
  readonly finished: FinishSyncLogInput[] = [];

  start(input: StartSyncLogInput) {
    this.started.push(input);
    return Promise.resolve({ id: `sync-${this.started.length}` });
  }

  finish(_id: string, input: FinishSyncLogInput) {
    this.finished.push(input);
    return Promise.resolve();
  }
}

const officialSenator = senadoCurrentSenatorSchema.parse(
  senadoCurrentSenatorFixture,
);
const clock = () => new Date('2026-09-06T20:00:00.000Z');

function gateway(items = [officialSenator]): SenadoGateway {
  return { listCurrentSenators: () => Promise.resolve(items) };
}

describe('SenadoSyncService', () => {
  it('sincroniza a lista atual e registra contadores de insert/update/unchanged', async () => {
    const repository = new InMemoryParlamentares();
    const logs = new InMemoryLogs();
    const service = new SenadoSyncService(gateway(), repository, logs, clock);

    const first = await service.syncSenators();
    const second = await service.syncSenators();
    const changed = {
      ...officialSenator,
      IdentificacaoParlamentar: {
        ...officialSenator.IdentificacaoParlamentar,
        SiglaPartidoParlamentar: 'XYZ',
      },
    };
    const third = await new SenadoSyncService(
      gateway([changed]),
      repository,
      logs,
      clock,
    ).syncSenators();

    expect(first).toMatchObject({
      processed: 1,
      inserted: 1,
      updated: 0,
      unchanged: 0,
    });
    expect(second).toMatchObject({
      processed: 1,
      inserted: 0,
      updated: 0,
      unchanged: 1,
    });
    expect(third).toMatchObject({
      processed: 1,
      inserted: 0,
      updated: 1,
      unchanged: 0,
    });
    expect(logs.started[0]).toMatchObject({
      source: 'SENADO',
      resource: 'SENADORES',
    });
    expect(logs.finished.every(({ status }) => status === 'SUCCESS')).toBe(
      true,
    );
  });

  it('preserva registros ausentes da fonte e não executa exclusões', async () => {
    const repository = new InMemoryParlamentares();
    repository.records.set('CAMARA:5672', {
      externalId: 5672,
      source: 'CAMARA',
      casa: 'CAMARA',
      nome: 'Deputado Fictício',
      nomeCivil: null,
      partido: null,
      uf: null,
      fotoUrl: null,
      email: null,
      situacao: null,
      legislatura: null,
      fetchedAt: clock(),
    });
    const service = new SenadoSyncService(
      gateway([]),
      repository,
      new InMemoryLogs(),
      clock,
    );

    const result = await service.syncSenators();

    expect(result).toMatchObject({
      processed: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
    });
    expect(repository.records.has('CAMARA:5672')).toBe(true);
  });

  it('registra FAILED quando a API oficial falha', async () => {
    const logs = new InMemoryLogs();
    const unavailable: SenadoGateway = {
      listCurrentSenators: () => Promise.reject(new SenadoUnavailableError()),
    };
    const service = new SenadoSyncService(
      unavailable,
      new InMemoryParlamentares(),
      logs,
      clock,
    );

    await expect(service.syncSenators()).rejects.toBeInstanceOf(
      SenadoUnavailableError,
    );
    expect(logs.finished[0]).toMatchObject({
      status: 'FAILED',
      processed: 0,
      errors: ['Não foi possível consultar a API do Senado.'],
    });
  });

  it('registra FAILED com mensagem segura quando o repository falha', async () => {
    const logs = new InMemoryLogs();
    const repository: ParlamentarRepositoryContract = {
      upsertMany: () => Promise.reject(new Error('Falha interna fictícia.')),
      list: () => Promise.resolve({ data: [], total: 0 }),
      findByExternalId: () => Promise.resolve(null),
    };
    const service = new SenadoSyncService(gateway(), repository, logs, clock);

    await expect(service.syncSenators()).rejects.toThrowError(
      'Falha interna fictícia.',
    );
    expect(logs.finished[0]).toMatchObject({
      status: 'FAILED',
      processed: 1,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      errors: ['Falha interna durante a sincronização.'],
    });
  });
});
