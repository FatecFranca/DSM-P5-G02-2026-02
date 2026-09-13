import { describe, expect, it } from 'vitest';

import { SenadorNotFoundError } from '../../../src/integrations/senado/senado.errors.js';
import { SenadorService } from '../../../src/modules/parlamentares/senador.service.js';
import type {
  ParlamentarRecord,
  ParlamentarRepositoryContract,
} from '../../../src/modules/parlamentares/parlamentar.types.js';

const senator: ParlamentarRecord = {
  externalId: 5672,
  source: 'SENADO',
  casa: 'SENADO',
  nome: 'Senadora Fictícia',
  nomeCivil: 'NOME COMPLETO FICTÍCIO',
  partido: 'ABC',
  uf: 'AC',
  fotoUrl: null,
  email: null,
  situacao: 'Titular',
  legislatura: null,
  fetchedAt: new Date('2026-09-06T20:00:00.000Z'),
};

function repository(
  found: ParlamentarRecord | null = senator,
): ParlamentarRepositoryContract {
  return {
    upsertMany: () =>
      Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
    list: () => Promise.resolve({ data: [senator], total: 21 }),
    findByExternalId: () => Promise.resolve(found),
  };
}

describe('SenadorService', () => {
  it('lista somente SENADO com paginação local', async () => {
    let received: unknown;
    const base = repository();
    base.list = (query) => {
      received = query;
      return Promise.resolve({ data: [senator], total: 21 });
    };

    const result = await new SenadorService(base).list({ page: 2, limit: 10 });

    expect(received).toEqual({ source: 'SENADO', page: 2, limit: 10 });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
    });
  });

  it('consulta detalhe somente pela identidade SENADO', async () => {
    let received: unknown;
    const base = repository();
    base.findByExternalId = (identity) => {
      received = identity;
      return Promise.resolve(senator);
    };

    const result = await new SenadorService(base).getById(5672);

    expect(received).toEqual({ source: 'SENADO', externalId: 5672 });
    expect(result.data).toMatchObject({
      externalId: 5672,
      source: 'SENADO',
      casa: 'SENADO',
    });
  });

  it('retorna erro quando o senador não está no MongoDB', async () => {
    await expect(
      new SenadorService(repository(null)).getById(999999),
    ).rejects.toBeInstanceOf(SenadorNotFoundError);
  });
});
