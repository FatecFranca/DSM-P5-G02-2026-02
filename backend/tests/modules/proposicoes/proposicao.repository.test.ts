import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import {
  buildProposicaoUpsertOperations,
  classifyProposicoes,
  ProposicaoRepository,
} from '../../../src/modules/proposicoes/proposicao.repository.js';
import type { ProposicaoPersistence } from '../../../src/modules/proposicoes/proposicao.model.js';
import type {
  ProposicaoInput,
  ProposicaoRecord,
} from '../../../src/modules/proposicoes/proposicao.types.js';

const fetchedAt = new Date('2026-09-05T12:00:00.000Z');
const input: ProposicaoInput = {
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
  autores: [
    {
      externalId: 204_379,
      nome: 'Deputado Fictício',
      tipo: 'Deputado',
      uri: 'https://dadosabertos.camara.leg.br/api/v2/deputados/204379',
      parlamentarExternalId: 204_379,
    },
    {
      externalId: null,
      nome: 'Órgão Fictício',
      tipo: 'Órgão',
      uri: null,
      parlamentarExternalId: null,
    },
  ],
  temasOficiais: [
    { codTema: 40, tema: 'Educação' },
    { codTema: 62, tema: 'Ciência, Tecnologia e Inovação' },
  ],
  fetchedAt,
};

function record(overrides: Partial<ProposicaoRecord> = {}): ProposicaoRecord {
  const merged = { ...input, ...overrides };
  return {
    ...merged,
    descricao: merged.descricao ?? null,
    situacao: merged.situacao ?? null,
  };
}

function persistedRecord(): ProposicaoPersistence {
  return {
    ...record(),
    createdAt: new Date('2026-09-05T12:00:00.000Z'),
    updatedAt: new Date('2026-09-05T12:00:00.000Z'),
  };
}

describe('classificação de proposições', () => {
  it('classifica documento novo como INSERTED', () => {
    expect(classifyProposicoes([input], [])[0]?.state).toBe('INSERTED');
  });

  it('mantém identidades iguais de fontes diferentes sem colisão', () => {
    const senateInput = { ...input, source: 'SENADO' as const };

    expect(classifyProposicoes([senateInput], [record()])[0]?.state).toBe(
      'INSERTED',
    );
    expect(
      buildProposicaoUpsertOperations([
        { state: 'INSERTED', item: senateInput },
      ])[0],
    ).toMatchObject({
      updateOne: {
        filter: { source: 'SENADO', externalId: 2_256_735 },
      },
    });
  });

  it('classifica mudança relevante como UPDATED', () => {
    expect(
      classifyProposicoes([input], [record({ ementa: 'Ementa anterior' })])[0]
        ?.state,
    ).toBe('UPDATED');
  });

  it('ignora fetchedAt, ordem dos autores e ordem dos temas', () => {
    const existing = record({
      fetchedAt: new Date('2026-09-04T12:00:00.000Z'),
      autores: [...input.autores].reverse(),
      temasOficiais: [...input.temasOficiais].reverse(),
    });

    expect(classifyProposicoes([input], [existing])[0]?.state).toBe(
      'UNCHANGED',
    );
  });

  it('ignora a ordem de autores com o mesmo ID e nome', () => {
    const autores = [
      {
        externalId: 204_379,
        nome: 'Autor Fictício',
        tipo: 'Deputado',
        uri: 'https://dadosabertos.camara.leg.br/api/v2/deputados/204379',
        parlamentarExternalId: 204_379,
      },
      {
        externalId: 204_379,
        nome: 'Autor Fictício',
        tipo: 'Representante de órgão',
        uri: 'https://dadosabertos.camara.leg.br/api/v2/orgaos/204379',
        parlamentarExternalId: null,
      },
    ];

    expect(
      classifyProposicoes(
        [{ ...input, autores }],
        [record({ autores: [...autores].reverse() })],
      )[0]?.state,
    ).toBe('UNCHANGED');
  });

  it('trata null, undefined e string vazia como ausência equivalente', () => {
    expect(
      classifyProposicoes(
        [{ ...input, descricao: undefined, situacao: '' }],
        [record({ descricao: null, situacao: null })],
      )[0]?.state,
    ).toBe('UNCHANGED');
  });

  it('atualiza somente fetchedAt quando o conteúdo não mudou', () => {
    const [operation] = buildProposicaoUpsertOperations([
      { state: 'UNCHANGED', item: input },
    ]);

    expect(operation).toEqual({
      updateOne: {
        filter: { source: 'CAMARA', externalId: 2_256_735 },
        update: { $set: { fetchedAt } },
        upsert: false,
        timestamps: false,
      },
    });
  });
});

describe('ProposicaoRepository', () => {
  it('não consulta o MongoDB quando não há itens para persistir', async () => {
    const find = vi.fn();
    const bulkWrite = vi.fn();
    const model = {
      find,
      bulkWrite,
    } as unknown as Model<ProposicaoPersistence>;

    await expect(
      new ProposicaoRepository(model).upsertMany([]),
    ).resolves.toEqual({ inserted: 0, updated: 0, unchanged: 0 });
    expect(find).not.toHaveBeenCalled();
    expect(bulkWrite).not.toHaveBeenCalled();
  });

  it('classifica e persiste o lote com bulk não ordenado', async () => {
    const exec = vi.fn(() => Promise.resolve([persistedRecord()]));
    const find = vi.fn(() => ({ lean: () => ({ exec }) }));
    const bulkWrite = vi.fn(() => Promise.resolve({}));
    const model = {
      find,
      bulkWrite,
    } as unknown as Model<ProposicaoPersistence>;
    const changed = { ...input, ementa: 'Ementa atualizada' };
    const inserted = { ...input, externalId: 2_256_736 };

    const result = await new ProposicaoRepository(model).upsertMany([
      changed,
      inserted,
    ]);

    expect(result).toEqual({ inserted: 1, updated: 1, unchanged: 0 });
    expect(find).toHaveBeenCalledWith({
      $or: [
        { source: 'CAMARA', externalId: 2_256_735 },
        { source: 'CAMARA', externalId: 2_256_736 },
      ],
    });
    expect(bulkWrite).toHaveBeenCalledWith(expect.any(Array), {
      ordered: false,
    });
  });

  it('lista no MongoDB com filtros e paginação', async () => {
    const exec = vi.fn(() => Promise.resolve([persistedRecord()]));
    const limit = vi.fn(() => ({ lean: () => ({ exec }) }));
    const skip = vi.fn(() => ({ limit }));
    const sort = vi.fn(() => ({ skip }));
    const countExec = vi.fn(() => Promise.resolve(11));
    const find = vi.fn(() => ({ sort }));
    const countDocuments = vi.fn(() => ({ exec: countExec }));
    const model = {
      find,
      countDocuments,
    } as unknown as Model<ProposicaoPersistence>;

    const result = await new ProposicaoRepository(model).list({
      source: 'CAMARA',
      page: 2,
      limit: 5,
      ano: 2025,
      tipo: 'PL',
      parlamentarExternalId: 204_379,
    });

    expect(result).toEqual({ data: [record()], total: 11 });
    expect(find).toHaveBeenCalledWith({
      source: 'CAMARA',
      ano: 2025,
      tipo: 'PL',
      'autores.parlamentarExternalId': 204_379,
    });
    expect(sort).toHaveBeenCalledWith({ dataApresentacao: -1, externalId: 1 });
    expect(skip).toHaveBeenCalledWith(5);
    expect(limit).toHaveBeenCalledWith(5);
  });

  it('consulta por identidade e retorna null quando não encontra', async () => {
    let result: ProposicaoPersistence | null = persistedRecord();
    const exec = vi.fn(() => Promise.resolve(result));
    const findOne = vi.fn(() => ({ lean: () => ({ exec }) }));
    const model = { findOne } as unknown as Model<ProposicaoPersistence>;
    const repository = new ProposicaoRepository(model);
    const identity = { source: 'CAMARA' as const, externalId: 2_256_735 };

    await expect(repository.findByExternalId(identity)).resolves.toEqual(
      record(),
    );
    result = null;
    await expect(repository.findByExternalId(identity)).resolves.toBeNull();
    expect(findOne).toHaveBeenCalledWith(identity);
  });

  it('aplica o filtro SENADO ao listar matérias por parlamentar', async () => {
    const exec = vi.fn(() => Promise.resolve([]));
    const limit = vi.fn(() => ({ lean: () => ({ exec }) }));
    const skip = vi.fn(() => ({ limit }));
    const sort = vi.fn(() => ({ skip }));
    const find = vi.fn(() => ({ sort }));
    const countDocuments = vi.fn(() => ({
      exec: () => Promise.resolve(0),
    }));
    const model = {
      find,
      countDocuments,
    } as unknown as Model<ProposicaoPersistence>;

    await new ProposicaoRepository(model).list({
      source: 'SENADO',
      page: 1,
      limit: 20,
      parlamentarExternalId: 5672,
    });

    expect(find).toHaveBeenCalledWith({
      source: 'SENADO',
      'autores.parlamentarExternalId': 5672,
    });
  });
});
