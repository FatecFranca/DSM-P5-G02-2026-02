import { describe, expect, it } from 'vitest';

import { DeputadoNotFoundError } from '../../../src/integrations/camara/camara.errors.js';
import { ParlamentarService } from '../../../src/modules/parlamentares/parlamentar.service.js';
import type {
  ParlamentarRecord,
  ParlamentarRepositoryContract,
} from '../../../src/modules/parlamentares/parlamentar.types.js';

const parlamentar: ParlamentarRecord = {
  externalId: 999_001,
  source: 'CAMARA',
  casa: 'CAMARA',
  nome: 'Deputada Fictícia',
  nomeCivil: null,
  partido: 'ABC',
  uf: 'SP',
  fotoUrl: null,
  email: null,
  situacao: null,
  legislatura: 57,
  fetchedAt: new Date('2026-09-05T12:00:00.000Z'),
};

describe('ParlamentarService', () => {
  it('lista somente deputados da Câmara com paginação local completa', async () => {
    let receivedQuery:
      { source: 'CAMARA'; page: number; limit: number } | undefined;
    const repository: ParlamentarRepositoryContract = {
      upsertMany: () =>
        Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
      list: (query) => {
        receivedQuery = query;
        return Promise.resolve({ data: [parlamentar], total: 11 });
      },
      findByExternalId: () => Promise.resolve(parlamentar),
    };
    const service = new ParlamentarService(repository);

    const result = await service.list({ page: 2, limit: 5 });

    expect(receivedQuery).toEqual({ source: 'CAMARA', page: 2, limit: 5 });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 11,
      totalPages: 3,
    });
    expect(result.data[0]?.externalId).toBe(999_001);
  });

  it('consulta o deputado armazenado pela identidade externa', async () => {
    let receivedIdentity: { source: 'CAMARA'; externalId: number } | undefined;
    const repository: ParlamentarRepositoryContract = {
      upsertMany: () =>
        Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
      list: () => Promise.resolve({ data: [], total: 0 }),
      findByExternalId: (identity) => {
        receivedIdentity = identity;
        return Promise.resolve(parlamentar);
      },
    };
    const service = new ParlamentarService(repository);

    const result = await service.getById(999_001);

    expect(receivedIdentity).toEqual({
      source: 'CAMARA',
      externalId: 999_001,
    });
    expect(result.data.nome).toBe('Deputada Fictícia');
  });

  it('retorna erro quando o deputado não está armazenado', async () => {
    const repository: ParlamentarRepositoryContract = {
      upsertMany: () =>
        Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
      list: () => Promise.resolve({ data: [], total: 0 }),
      findByExternalId: () => Promise.resolve(null),
    };
    const service = new ParlamentarService(repository);

    await expect(service.getById(999_999)).rejects.toBeInstanceOf(
      DeputadoNotFoundError,
    );
  });
});
