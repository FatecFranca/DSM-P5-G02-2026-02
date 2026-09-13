import { describe, expect, it } from 'vitest';

import { CamaraUnavailableError } from '../../../src/integrations/camara/camara.errors.js';
import type {
  CamaraGateway,
  CamaraProposicaoQuery,
} from '../../../src/integrations/camara/camara.types.js';
import type { ParlamentarRepositoryContract } from '../../../src/modules/parlamentares/parlamentar.types.js';
import { classifyProposicoes } from '../../../src/modules/proposicoes/proposicao.repository.js';
import type {
  ProposicaoInput,
  ProposicaoRecord,
  ProposicaoRepositoryContract,
} from '../../../src/modules/proposicoes/proposicao.types.js';
import { ProposicaoSyncService } from '../../../src/modules/sync/proposicao-sync.service.js';
import type {
  FinishSyncLogInput,
  StartSyncLogInput,
  SyncLogRepositoryContract,
} from '../../../src/modules/sync/sync.types.js';
import {
  camaraDetailResponseFixture,
  camaraListResponseFixture,
  camaraProposicaoAutoresResponseFixture,
  camaraProposicaoDetailFixture,
  camaraProposicaoDetailResponseFixture,
  camaraProposicaoListResponseFixture,
  camaraProposicaoTemasResponseFixture,
} from '../../fixtures/camara.js';

class InMemoryProposicaoRepository implements ProposicaoRepositoryContract {
  readonly records = new Map<number, ProposicaoRecord>();

  upsertMany(items: ProposicaoInput[]) {
    const classified = classifyProposicoes(items, [...this.records.values()]);
    for (const item of items) {
      this.records.set(item.externalId, {
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
    return Promise.resolve({ data: [...this.records.values()], total: 0 });
  }

  findByExternalId() {
    return Promise.resolve(null);
  }
}

class InMemorySyncLogs implements SyncLogRepositoryContract {
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

function parlamentares(): ParlamentarRepositoryContract {
  return {
    upsertMany: () =>
      Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
    list: () => Promise.resolve({ data: [], total: 0 }),
    findByExternalId: ({ externalId }) =>
      Promise.resolve(
        externalId === 204_379
          ? {
              externalId,
              source: 'CAMARA',
              casa: 'CAMARA',
              nome: 'Deputado Fictício',
              nomeCivil: null,
              partido: null,
              uf: null,
              fotoUrl: null,
              email: null,
              situacao: null,
              legislatura: 57,
              fetchedAt: new Date(),
            }
          : null,
      ),
  };
}

function gateway(
  listProposicoes: CamaraGateway['listProposicoes'] = () =>
    Promise.resolve(camaraProposicaoListResponseFixture),
): CamaraGateway {
  return {
    listDeputados: () => Promise.resolve(camaraListResponseFixture),
    getDeputado: () => Promise.resolve(camaraDetailResponseFixture),
    listProposicoes,
    getProposicao: () => Promise.resolve(camaraProposicaoDetailResponseFixture),
    getProposicaoAutores: () =>
      Promise.resolve(camaraProposicaoAutoresResponseFixture),
    getProposicaoTemas: () =>
      Promise.resolve(camaraProposicaoTemasResponseFixture),
  };
}

const input = {
  ano: 2025,
  deputadoIds: [204_379],
  maxProposicoes: 10,
};
const clock = () => new Date('2026-09-05T12:00:00.000Z');

describe('ProposicaoSyncService', () => {
  it('usa filtros controlados, relaciona deputado e registra sucesso', async () => {
    let receivedQuery: CamaraProposicaoQuery | undefined;
    const client = gateway((query) => {
      receivedQuery = query;
      return Promise.resolve(camaraProposicaoListResponseFixture);
    });
    const repository = new InMemoryProposicaoRepository();
    const logs = new InMemorySyncLogs();
    const service = new ProposicaoSyncService(
      client,
      repository,
      parlamentares(),
      logs,
      clock,
    );

    const result = await service.syncProposicoes(input);

    expect(receivedQuery).toEqual({
      ano: 2025,
      deputadoIds: [204_379],
      pagina: 1,
      itens: 10,
    });
    expect(result).toEqual({
      source: 'CAMARA',
      resource: 'PROPOSICOES',
      status: 'SUCCESS',
      processed: 1,
      inserted: 1,
      updated: 0,
      unchanged: 0,
      errors: [],
    });
    expect(repository.records.get(2_256_735)?.autores[0]).toMatchObject({
      parlamentarExternalId: 204_379,
    });
    expect(repository.records.get(2_256_735)?.temasOficiais).toHaveLength(2);
    expect(logs.started[0]?.resource).toBe('PROPOSICOES');
    expect(logs.finished[0]?.status).toBe('SUCCESS');
  });

  it('executa o mesmo escopo duas vezes sem duplicar', async () => {
    const repository = new InMemoryProposicaoRepository();
    const service = new ProposicaoSyncService(
      gateway(),
      repository,
      parlamentares(),
      new InMemorySyncLogs(),
      clock,
    );

    await service.syncProposicoes(input);
    const second = await service.syncProposicoes(input);

    expect(second).toMatchObject({ inserted: 0, updated: 0, unchanged: 1 });
    expect(repository.records.size).toBe(1);
  });

  it('continua o lote e registra PARTIAL quando uma proposição falha', async () => {
    const secondId = 2_256_736;
    const client = gateway(() =>
      Promise.resolve({
        ...camaraProposicaoListResponseFixture,
        dados: [
          camaraProposicaoListResponseFixture.dados[0],
          { ...camaraProposicaoListResponseFixture.dados[0], id: secondId },
        ],
      }),
    );
    client.getProposicao = (id) =>
      id === 2_256_735
        ? Promise.reject(new CamaraUnavailableError())
        : Promise.resolve({
            ...camaraProposicaoDetailResponseFixture,
            dados: { ...camaraProposicaoDetailFixture, id },
          });
    const repository = new InMemoryProposicaoRepository();
    const logs = new InMemorySyncLogs();
    const service = new ProposicaoSyncService(
      client,
      repository,
      parlamentares(),
      logs,
      clock,
    );

    const result = await service.syncProposicoes(input);

    expect(result.status).toBe('PARTIAL');
    expect(result.processed).toBe(2);
    expect(result.inserted).toBe(1);
    expect(result.errors).toEqual([
      'Proposição 2256735: Não foi possível consultar a API da Câmara.',
    ]);
    expect(repository.records.has(secondId)).toBe(true);
    expect(logs.finished[0]?.status).toBe('PARTIAL');
  });

  it.each(['getProposicaoAutores', 'getProposicaoTemas'] as const)(
    'não persiste dados incompletos e registra PARTIAL quando %s falha',
    async (method) => {
      const client = gateway();
      if (method === 'getProposicaoAutores') {
        client.getProposicaoAutores = () =>
          Promise.reject(new CamaraUnavailableError());
      } else {
        client.getProposicaoTemas = () =>
          Promise.reject(new CamaraUnavailableError());
      }
      const repository = new InMemoryProposicaoRepository();
      const logs = new InMemorySyncLogs();
      const service = new ProposicaoSyncService(
        client,
        repository,
        parlamentares(),
        logs,
        clock,
      );

      const result = await service.syncProposicoes(input);

      expect(result).toMatchObject({
        status: 'PARTIAL',
        processed: 1,
        inserted: 0,
        updated: 0,
        unchanged: 0,
      });
      expect(result.errors).toHaveLength(1);
      expect(repository.records.size).toBe(0);
      expect(logs.finished[0]?.status).toBe('PARTIAL');
    },
  );

  it('registra FAILED e propaga erro quando a listagem da Câmara falha', async () => {
    const logs = new InMemorySyncLogs();
    const service = new ProposicaoSyncService(
      gateway(() => Promise.reject(new CamaraUnavailableError())),
      new InMemoryProposicaoRepository(),
      parlamentares(),
      logs,
      clock,
    );

    await expect(service.syncProposicoes(input)).rejects.toBeInstanceOf(
      CamaraUnavailableError,
    );
    expect(logs.finished[0]).toMatchObject({
      status: 'FAILED',
      processed: 0,
      errors: ['Não foi possível consultar a API da Câmara.'],
    });
  });
});
