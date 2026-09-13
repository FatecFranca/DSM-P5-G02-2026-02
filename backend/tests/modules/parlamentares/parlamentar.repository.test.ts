import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import {
  buildParlamentarUpsertOperations,
  classifyParlamentares,
  ParlamentarRepository,
} from '../../../src/modules/parlamentares/parlamentar.repository.js';
import type { ParlamentarPersistence } from '../../../src/modules/parlamentares/parlamentar.model.js';
import type {
  ParlamentarInput,
  ParlamentarRecord,
} from '../../../src/modules/parlamentares/parlamentar.types.js';

const previousFetchedAt = new Date('2026-09-05T12:00:00.000Z');
const currentFetchedAt = new Date('2026-09-05T13:00:00.000Z');

const input: ParlamentarInput = {
  externalId: 999_001,
  source: 'CAMARA',
  casa: 'CAMARA',
  nome: 'Deputada Fictícia',
  partido: 'ABC',
  uf: 'SP',
  fotoUrl: null,
  email: null,
  legislatura: 57,
  fetchedAt: currentFetchedAt,
};

const existing: ParlamentarRecord = {
  ...input,
  nomeCivil: null,
  situacao: null,
  fetchedAt: previousFetchedAt,
};

describe('classifyParlamentares', () => {
  it('classifica um parlamentar novo como INSERTED', () => {
    expect(classifyParlamentares([input], [])).toEqual([
      { state: 'INSERTED', item: input },
    ]);
  });

  it('classifica dados oficiais iguais como UNCHANGED', () => {
    expect(classifyParlamentares([input], [existing])).toEqual([
      { state: 'UNCHANGED', item: input },
    ]);
  });

  it('classifica mudança de partido como UPDATED', () => {
    const changed = { ...input, partido: 'XYZ' };

    expect(classifyParlamentares([changed], [existing])).toEqual([
      { state: 'UPDATED', item: changed },
    ]);
  });

  it('não considera alteração somente de fetchedAt como conteúdo atualizado', () => {
    const sameContent = {
      ...input,
      fetchedAt: new Date('2026-09-06T12:00:00.000Z'),
    };

    expect(classifyParlamentares([sameContent], [existing])[0]?.state).toBe(
      'UNCHANGED',
    );
  });

  it('trata undefined, null e string vazia como ausência equivalente', () => {
    const withEmptyOptionals = {
      ...input,
      nomeCivil: undefined,
      partido: '  ',
      situacao: undefined,
    };
    const existingWithNulls = { ...existing, partido: null };

    expect(
      classifyParlamentares([withEmptyOptionals], [existingWithNulls])[0]
        ?.state,
    ).toBe('UNCHANGED');
  });

  it('classifica uma mistura de novos, alterados e inalterados', () => {
    const updated = { ...input, externalId: 999_002, partido: 'NOVO' };
    const unchanged = { ...input, externalId: 999_003 };
    const inserted = { ...input, externalId: 999_004 };
    const existingUpdated = {
      ...existing,
      externalId: 999_002,
      partido: 'ANTIGO',
    };
    const existingUnchanged = { ...existing, externalId: 999_003 };

    expect(
      classifyParlamentares(
        [updated, unchanged, inserted],
        [existingUpdated, existingUnchanged],
      ).map(({ state }) => state),
    ).toEqual(['UPDATED', 'UNCHANGED', 'INSERTED']);
  });

  it('permite o mesmo externalId em CAMARA e SENADO', () => {
    const senator = {
      ...input,
      source: 'SENADO' as const,
      casa: 'SENADO' as const,
    };

    expect(classifyParlamentares([senator], [existing])[0]?.state).toBe(
      'INSERTED',
    );
  });

  it('ignora fetchedAt e ausências equivalentes para SENADO', () => {
    const senator = {
      ...input,
      source: 'SENADO' as const,
      casa: 'SENADO' as const,
      nomeCivil: undefined,
      partido: '',
      legislatura: null,
      fetchedAt: new Date('2026-09-06T12:00:00.000Z'),
    };
    const stored = {
      ...existing,
      source: 'SENADO' as const,
      casa: 'SENADO' as const,
      nomeCivil: null,
      partido: null,
      legislatura: null,
    };

    expect(classifyParlamentares([senator], [stored])[0]?.state).toBe(
      'UNCHANGED',
    );
  });
});

describe('buildParlamentarUpsertOperations', () => {
  it('atualiza somente fetchedAt para conteúdo inalterado', () => {
    expect(
      buildParlamentarUpsertOperations([{ state: 'UNCHANGED', item: input }]),
    ).toEqual([
      {
        updateOne: {
          filter: { source: 'CAMARA', externalId: 999_001 },
          update: { $set: { fetchedAt: currentFetchedAt } },
          upsert: false,
          timestamps: false,
        },
      },
    ]);
  });

  it('faz upsert dos dados completos para conteúdo novo', () => {
    expect(
      buildParlamentarUpsertOperations([{ state: 'INSERTED', item: input }]),
    ).toEqual([
      {
        updateOne: {
          filter: { source: 'CAMARA', externalId: 999_001 },
          update: { $set: input },
          upsert: true,
        },
      },
    ]);
  });
});

describe('ParlamentarRepository com SENADO', () => {
  const senatorDocument: ParlamentarPersistence = {
    externalId: 5672,
    source: 'SENADO',
    casa: 'SENADO',
    nome: 'Senadora Fictícia',
    nomeCivil: null,
    partido: 'ABC',
    uf: 'AC',
    fotoUrl: null,
    email: null,
    situacao: 'Titular',
    legislatura: null,
    fetchedAt: currentFetchedAt,
    createdAt: previousFetchedAt,
    updatedAt: previousFetchedAt,
  };

  it('consulta somente SENADO com paginação e ordenação determinística', async () => {
    const exec = vi.fn(() => Promise.resolve([senatorDocument]));
    const limit = vi.fn(() => ({ lean: () => ({ exec }) }));
    const skip = vi.fn(() => ({ limit }));
    const sort = vi.fn(() => ({ skip }));
    const find = vi.fn(() => ({ sort }));
    const countDocuments = vi.fn(() => ({
      exec: () => Promise.resolve(81),
    }));
    const model = {
      find,
      countDocuments,
    } as unknown as Model<ParlamentarPersistence>;

    const result = await new ParlamentarRepository(model).list({
      source: 'SENADO',
      page: 2,
      limit: 20,
    });

    expect(find).toHaveBeenCalledWith({ source: 'SENADO' });
    expect(sort).toHaveBeenCalledWith({ nome: 1, externalId: 1 });
    expect(skip).toHaveBeenCalledWith(20);
    expect(limit).toHaveBeenCalledWith(20);
    expect(result.total).toBe(81);
    expect(result.data[0]?.source).toBe('SENADO');
  });

  it('consulta detalhe usando source e externalId', async () => {
    const exec = vi.fn(() => Promise.resolve(senatorDocument));
    const findOne = vi.fn(() => ({ lean: () => ({ exec }) }));
    const model = { findOne } as unknown as Model<ParlamentarPersistence>;

    const result = await new ParlamentarRepository(model).findByExternalId({
      source: 'SENADO',
      externalId: 5672,
    });

    expect(findOne).toHaveBeenCalledWith({
      source: 'SENADO',
      externalId: 5672,
    });
    expect(result?.source).toBe('SENADO');
  });

  it('persiste identidades CAMARA e SENADO iguais sem colisão lógica', async () => {
    const exec = vi.fn(() => Promise.resolve([]));
    const find = vi.fn(() => ({ lean: () => ({ exec }) }));
    const bulkWrite = vi.fn(() => Promise.resolve({}));
    const model = {
      find,
      bulkWrite,
    } as unknown as Model<ParlamentarPersistence>;
    const senator = {
      ...input,
      source: 'SENADO' as const,
      casa: 'SENADO' as const,
    };

    const result = await new ParlamentarRepository(model).upsertMany([
      input,
      senator,
    ]);

    expect(result).toEqual({ inserted: 2, updated: 0, unchanged: 0 });
    expect(find).toHaveBeenCalledWith({
      $or: [
        { source: 'CAMARA', externalId: 999_001 },
        { source: 'SENADO', externalId: 999_001 },
      ],
    });
  });
});
