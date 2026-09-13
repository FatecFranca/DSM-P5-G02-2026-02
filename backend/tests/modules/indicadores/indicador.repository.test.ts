import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type {
  ParticipacaoOrgaoPersistence,
  VotacaoPersistence,
  VotoPersistence,
} from '../../../src/modules/indicadores/indicador.model.js';
import {
  classifyParticipacoesOrgaos,
  classifyVotacoes,
  classifyVotos,
  ParticipacaoOrgaoRepository,
  VotacaoRepository,
  VotoRepository,
} from '../../../src/modules/indicadores/indicador.repository.js';
import type {
  ParticipacaoOrgaoInput,
  VotacaoInput,
  VotoInput,
} from '../../../src/modules/indicadores/indicador.types.js';

const fetchedAt = new Date('2026-09-07T20:00:00.000Z');
const votacao: VotacaoInput = {
  source: 'CAMARA',
  externalId: '2633410-8',
  data: new Date('2026-06-17T00:00:00.000Z'),
  descricao: 'Descrição oficial',
  resultado: '1',
  casa: 'CAMARA',
  proposicaoExternalId: 2_633_410,
  fetchedAt,
};
const voto: VotoInput = {
  source: 'CAMARA',
  votacaoExternalId: '2633410-8',
  parlamentarExternalId: 204_379,
  voto: 'Sim',
  data: new Date('2026-06-17T00:00:00.000Z'),
  fetchedAt,
};
const participacao: ParticipacaoOrgaoInput = {
  source: 'CAMARA',
  orgaoExternalId: 2003,
  parlamentarExternalId: 204_379,
  sigla: 'CCJC',
  nome: 'Comissão de Constituição e Justiça e de Cidadania',
  casa: 'CAMARA',
  funcao: 'Titular',
  inicio: new Date('2026-03-05T00:00:00.000Z'),
  fim: null,
  fetchedAt,
};

describe('classificação idempotente dos indicadores', () => {
  it('classifica insert, update e unchanged sem considerar fetchedAt', () => {
    expect(classifyVotacoes([votacao], [])[0]?.state).toBe('INSERTED');
    expect(
      classifyVotacoes([votacao], [{ ...votacao, descricao: 'Anterior' }])[0]
        ?.state,
    ).toBe('UPDATED');
    expect(
      classifyVotacoes(
        [votacao],
        [{ ...votacao, fetchedAt: new Date('2026-09-06T20:00:00.000Z') }],
      )[0]?.state,
    ).toBe('UNCHANGED');
  });

  it('mantém o mesmo externalId independente entre as casas', () => {
    expect(
      classifyVotacoes([{ ...votacao, source: 'SENADO' }], [votacao])[0]?.state,
    ).toBe('INSERTED');
  });

  it('classifica votos pela chave votação + parlamentar + source', () => {
    expect(classifyVotos([voto], [])[0]?.state).toBe('INSERTED');
    expect(classifyVotos([{ ...voto, voto: 'Não' }], [voto])[0]?.state).toBe(
      'UPDATED',
    );
    expect(classifyVotos([voto], [voto])[0]?.state).toBe('UNCHANGED');
  });

  it('normaliza ausência equivalente nas participações em órgãos', () => {
    expect(
      classifyParticipacoesOrgaos(
        [{ ...participacao, funcao: undefined, fim: undefined }],
        [{ ...participacao, funcao: null, fim: null }],
      )[0]?.state,
    ).toBe('UNCHANGED');
  });
});

function emptyFindModel<T>() {
  const exec = vi.fn(() => Promise.resolve([]));
  const find = vi.fn(() => ({ lean: () => ({ exec }) }));
  const bulkWrite = vi.fn(() => Promise.resolve({}));
  return { model: { find, bulkWrite } as unknown as Model<T>, find, bulkWrite };
}

describe('repositories de indicadores', () => {
  it('persiste votações, votos e participações com bulk não ordenado', async () => {
    const voting = emptyFindModel<VotacaoPersistence>();
    const votes = emptyFindModel<VotoPersistence>();
    const memberships = emptyFindModel<ParticipacaoOrgaoPersistence>();

    await expect(
      new VotacaoRepository(voting.model).upsertMany([votacao]),
    ).resolves.toEqual({ inserted: 1, updated: 0, unchanged: 0 });
    await expect(
      new VotoRepository(votes.model).upsertMany([voto]),
    ).resolves.toEqual({ inserted: 1, updated: 0, unchanged: 0 });
    await expect(
      new ParticipacaoOrgaoRepository(memberships.model).upsertMany([
        participacao,
      ]),
    ).resolves.toEqual({ inserted: 1, updated: 0, unchanged: 0 });

    expect(voting.find).toHaveBeenCalledWith({
      $or: [{ source: 'CAMARA', externalId: '2633410-8' }],
    });
    expect(votes.find).toHaveBeenCalledWith({
      $or: [
        {
          source: 'CAMARA',
          votacaoExternalId: '2633410-8',
          parlamentarExternalId: 204_379,
        },
      ],
    });
    expect(memberships.bulkWrite).toHaveBeenCalledWith(expect.any(Array), {
      ordered: false,
    });
  });

  it('não consulta nem escreve lote vazio', async () => {
    const voting = emptyFindModel<VotacaoPersistence>();

    await expect(
      new VotacaoRepository(voting.model).upsertMany([]),
    ).resolves.toEqual({ inserted: 0, updated: 0, unchanged: 0 });
    expect(voting.find).not.toHaveBeenCalled();
    expect(voting.bulkWrite).not.toHaveBeenCalled();
  });
});
