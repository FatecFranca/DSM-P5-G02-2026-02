import { describe, expect, it } from 'vitest';

import {
  DeputadoNotFoundError,
  ProposicaoNotFoundError,
} from '../../../src/integrations/camara/camara.errors.js';
import type { ParlamentarRepositoryContract } from '../../../src/modules/parlamentares/parlamentar.types.js';
import { ProposicaoService } from '../../../src/modules/proposicoes/proposicao.service.js';
import type {
  ProposicaoRecord,
  ProposicaoRepositoryContract,
} from '../../../src/modules/proposicoes/proposicao.types.js';

const record: ProposicaoRecord = {
  externalId: 2_256_735,
  source: 'CAMARA',
  tipo: 'PL',
  numero: 1234,
  ano: 2025,
  ementa: 'Ementa fictícia',
  descricao: null,
  dataApresentacao: new Date('2025-03-10T10:30:00.000Z'),
  situacao: 'Em tramitação',
  uri: 'https://dadosabertos.camara.leg.br/api/v2/proposicoes/2256735',
  urlFonte: null,
  autores: [],
  temasOficiais: [{ codTema: 40, tema: 'Educação' }],
  fetchedAt: new Date('2026-09-05T12:00:00.000Z'),
};

function parlamentarRepository(found = true): ParlamentarRepositoryContract {
  return {
    upsertMany: () =>
      Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
    list: () => Promise.resolve({ data: [], total: 0 }),
    findByExternalId: () =>
      Promise.resolve(
        found
          ? {
              externalId: 204_379,
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

describe('ProposicaoService', () => {
  it('lista com paginação e filtros simples', async () => {
    let receivedQuery: unknown;
    const repository: ProposicaoRepositoryContract = {
      upsertMany: () =>
        Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
      list: (query) => {
        receivedQuery = query;
        return Promise.resolve({ data: [record], total: 21 });
      },
      findByExternalId: () => Promise.resolve(null),
    };
    const service = new ProposicaoService(repository, parlamentarRepository());

    const result = await service.list({
      page: 2,
      limit: 10,
      ano: 2025,
      tipo: 'PL',
    });

    expect(receivedQuery).toEqual({
      source: 'CAMARA',
      page: 2,
      limit: 10,
      ano: 2025,
      tipo: 'PL',
    });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
    });
    expect(result.data[0]?.dataApresentacao).toBe('2025-03-10T10:30:00.000Z');
  });

  it('lista e consulta SENADO quando a fonte é explícita', async () => {
    const senateRecord = { ...record, source: 'SENADO' as const };
    const received: unknown[] = [];
    const repository: ProposicaoRepositoryContract = {
      upsertMany: () =>
        Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
      list: (query) => {
        received.push(query);
        return Promise.resolve({ data: [senateRecord], total: 1 });
      },
      findByExternalId: (identity) => {
        received.push(identity);
        return Promise.resolve(senateRecord);
      },
    };
    const service = new ProposicaoService(repository, parlamentarRepository());

    const list = await service.list({ page: 1, limit: 5, source: 'SENADO' });
    const detail = await service.getById(2_256_735, 'SENADO');

    expect(received).toEqual([
      { source: 'SENADO', page: 1, limit: 5 },
      { source: 'SENADO', externalId: 2_256_735 },
    ]);
    expect(list.data[0]?.source).toBe('SENADO');
    expect(detail.data.source).toBe('SENADO');
  });

  it('retorna detalhe normalizado e lança 404 quando não existe', async () => {
    let current: ProposicaoRecord | null = record;
    const repository: ProposicaoRepositoryContract = {
      upsertMany: () =>
        Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
      list: () => Promise.resolve({ data: [], total: 0 }),
      findByExternalId: () => Promise.resolve(current),
    };
    const service = new ProposicaoService(repository, parlamentarRepository());

    await expect(service.getById(2_256_735)).resolves.toMatchObject({
      data: { externalId: 2_256_735, temasOficiais: record.temasOficiais },
    });
    current = null;
    await expect(service.getById(9_999_999)).rejects.toBeInstanceOf(
      ProposicaoNotFoundError,
    );
  });

  it('verifica o deputado e lista somente suas proposições', async () => {
    let receivedQuery: unknown;
    const repository: ProposicaoRepositoryContract = {
      upsertMany: () =>
        Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
      list: (query) => {
        receivedQuery = query;
        return Promise.resolve({ data: [record], total: 1 });
      },
      findByExternalId: () => Promise.resolve(null),
    };
    const service = new ProposicaoService(repository, parlamentarRepository());

    const result = await service.listByParlamentar(204_379, {
      page: 1,
      limit: 20,
    });

    expect(receivedQuery).toEqual({
      source: 'CAMARA',
      page: 1,
      limit: 20,
      parlamentarExternalId: 204_379,
    });
    expect(result.pagination.total).toBe(1);
  });

  it('rejeita proposições por deputado quando o parlamentar não existe', async () => {
    const repository: ProposicaoRepositoryContract = {
      upsertMany: () =>
        Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
      list: () => Promise.resolve({ data: [], total: 0 }),
      findByExternalId: () => Promise.resolve(null),
    };
    const service = new ProposicaoService(
      repository,
      parlamentarRepository(false),
    );

    await expect(
      service.listByParlamentar(999_999, { page: 1, limit: 20 }),
    ).rejects.toBeInstanceOf(DeputadoNotFoundError);
  });
});
