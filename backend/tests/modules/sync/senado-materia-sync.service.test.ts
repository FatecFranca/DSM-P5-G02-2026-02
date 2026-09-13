import { describe, expect, it } from 'vitest';

import { SenadoUnavailableError } from '../../../src/integrations/senado/senado.errors.js';
import {
  senadoMateriaDetailSchema,
  senadoMateriaListResponseSchema,
} from '../../../src/integrations/senado/senado.schemas.js';
import type {
  SenadoMateriaGateway,
  SenadoMateriaQuery,
} from '../../../src/integrations/senado/senado.types.js';
import type { ParlamentarRepositoryContract } from '../../../src/modules/parlamentares/parlamentar.types.js';
import { classifyProposicoes } from '../../../src/modules/proposicoes/proposicao.repository.js';
import type {
  ProposicaoInput,
  ProposicaoRecord,
  ProposicaoRepositoryContract,
} from '../../../src/modules/proposicoes/proposicao.types.js';
import { SenadoMateriaSyncService } from '../../../src/modules/sync/senado-materia-sync.service.js';
import type {
  FinishSyncLogInput,
  StartSyncLogInput,
  SyncLogRepositoryContract,
} from '../../../src/modules/sync/sync.types.js';
import {
  senadoMateriaDetailFixture,
  senadoMateriaListFixture,
  senadoMateriaWithoutThemesFixture,
} from '../../fixtures/senado-materias.js';

class InMemoryProposicoes implements ProposicaoRepositoryContract {
  readonly records = new Map<string, ProposicaoRecord>();

  upsertMany(items: ProposicaoInput[]) {
    const classified = classifyProposicoes(items, [...this.records.values()]);
    for (const item of items) {
      this.records.set(`${item.source}:${item.externalId}`, {
        ...item,
        descricao: item.descricao ?? null,
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

function parlamentares(found = true): ParlamentarRepositoryContract {
  return {
    upsertMany: () =>
      Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
    list: () => Promise.resolve({ data: [], total: 0 }),
    findByExternalId: ({ source, externalId }) =>
      Promise.resolve(
        found && source === 'SENADO' && [4560, 5672].includes(externalId)
          ? {
              externalId,
              source: 'SENADO',
              casa: 'SENADO',
              nome: 'Senador Fictício',
              nomeCivil: null,
              partido: null,
              uf: null,
              fotoUrl: null,
              email: null,
              situacao: null,
              legislatura: null,
              fetchedAt: new Date(),
            }
          : null,
      ),
  };
}

const list = senadoMateriaListResponseSchema.parse(senadoMateriaListFixture);
const firstDetail = senadoMateriaDetailSchema.parse(senadoMateriaDetailFixture);
const secondDetail = senadoMateriaDetailSchema.parse(
  senadoMateriaWithoutThemesFixture,
);
const clock = () => new Date('2026-09-06T21:00:00.000Z');
const input = {
  ano: 2026,
  senadorIds: [5672],
  siglas: ['INS'],
  maxMaterias: 3,
};

function gateway(): SenadoMateriaGateway {
  return {
    listMaterias: () => Promise.resolve(list),
    getMateriaById: (id) =>
      Promise.resolve({
        data: id === 9_048_130 ? firstDetail : secondDetail,
        uri: `https://legis.senado.leg.br/dadosabertos/processo/${id}.json`,
      }),
  };
}

describe('SenadoMateriaSyncService', () => {
  it('usa filtros oficiais, deduplica e registra sucesso', async () => {
    const queries: SenadoMateriaQuery[] = [];
    const client = gateway();
    client.listMaterias = (query) => {
      queries.push(query);
      return Promise.resolve(list);
    };
    const repository = new InMemoryProposicoes();
    const logs = new InMemoryLogs();
    const service = new SenadoMateriaSyncService(
      client,
      repository,
      parlamentares(),
      logs,
      clock,
    );

    const result = await service.syncMaterias({
      ...input,
      senadorIds: [5672, 4560],
    });

    expect(queries).toEqual([
      { ano: 2026, senadorId: 5672, siglas: ['INS'] },
      { ano: 2026, senadorId: 4560, siglas: ['INS'] },
    ]);
    expect(result).toEqual({
      source: 'SENADO',
      resource: 'MATERIAS',
      status: 'SUCCESS',
      processed: 2,
      inserted: 2,
      updated: 0,
      unchanged: 0,
      errors: [],
    });
    expect(repository.records.size).toBe(2);
    expect(logs.started[0]).toMatchObject({
      source: 'SENADO',
      resource: 'MATERIAS',
    });
  });

  it('é idempotente e detecta alteração oficial', async () => {
    const repository = new InMemoryProposicoes();
    const service = new SenadoMateriaSyncService(
      gateway(),
      repository,
      parlamentares(),
      new InMemoryLogs(),
      clock,
    );

    await service.syncMaterias(input);
    const second = await service.syncMaterias(input);
    const changedClient = gateway();
    changedClient.getMateriaById = (id) =>
      Promise.resolve({
        data: {
          ...(id === 9_048_130 ? firstDetail : secondDetail),
          situacaoAtual: 'SITUAÇÃO ALTERADA',
        },
        uri: `https://legis.senado.leg.br/dadosabertos/processo/${id}.json`,
      });
    const changed = await new SenadoMateriaSyncService(
      changedClient,
      repository,
      parlamentares(),
      new InMemoryLogs(),
      clock,
    ).syncMaterias(input);

    expect(second).toMatchObject({ inserted: 0, updated: 0, unchanged: 2 });
    expect(changed).toMatchObject({ inserted: 0, updated: 2, unchanged: 0 });
  });

  it('registra PARTIAL e preserva dados bons quando um detalhe falha', async () => {
    const repository = new InMemoryProposicoes();
    await new SenadoMateriaSyncService(
      gateway(),
      repository,
      parlamentares(),
      new InMemoryLogs(),
      clock,
    ).syncMaterias(input);
    const previous = repository.records.get('SENADO:9048130');
    const client = gateway();
    client.getMateriaById = (id) =>
      id === 9_048_130
        ? Promise.reject(new SenadoUnavailableError())
        : Promise.resolve({
            data: secondDetail,
            uri: `https://legis.senado.leg.br/dadosabertos/processo/${id}.json`,
          });
    const logs = new InMemoryLogs();

    const result = await new SenadoMateriaSyncService(
      client,
      repository,
      parlamentares(),
      logs,
      clock,
    ).syncMaterias(input);

    expect(result).toMatchObject({
      status: 'PARTIAL',
      processed: 2,
      inserted: 0,
      updated: 0,
      unchanged: 1,
    });
    expect(result.errors).toHaveLength(1);
    expect(repository.records.get('SENADO:9048130')).toEqual(previous);
    expect(logs.finished[0]?.status).toBe('PARTIAL');
  });

  it('registra FAILED quando listagem ou senador falha', async () => {
    const logs = new InMemoryLogs();
    const client = gateway();
    client.listMaterias = () => Promise.reject(new SenadoUnavailableError());
    const unavailable = new SenadoMateriaSyncService(
      client,
      new InMemoryProposicoes(),
      parlamentares(),
      logs,
      clock,
    );

    await expect(unavailable.syncMaterias(input)).rejects.toBeInstanceOf(
      SenadoUnavailableError,
    );
    await expect(
      new SenadoMateriaSyncService(
        gateway(),
        new InMemoryProposicoes(),
        parlamentares(false),
        logs,
        clock,
      ).syncMaterias(input),
    ).rejects.toThrowError('Senador não encontrado.');
    expect(logs.finished.every(({ status }) => status === 'FAILED')).toBe(true);
  });
});
