import { describe, expect, it } from 'vitest';

import { ProposicaoModel } from '../../../src/modules/proposicoes/proposicao.model.js';

describe('ProposicaoModel', () => {
  it('usa a collection proposicoes e índice único source + externalId', () => {
    expect(ProposicaoModel.collection.collectionName).toBe('proposicoes');
    expect(ProposicaoModel.schema.indexes()).toContainEqual([
      { source: 1, externalId: 1 },
      { unique: true },
    ]);
    expect(ProposicaoModel.schema.indexes()).toContainEqual([
      { source: 1, 'autores.parlamentarExternalId': 1, ano: 1 },
      {},
    ]);
  });

  it('aceita matérias do Senado sem alterar a identidade composta', async () => {
    const materia = new ProposicaoModel({
      externalId: 9_048_130,
      source: 'SENADO',
      tipo: 'INS',
      numero: 15,
      ano: 2026,
      uri: 'https://legis.senado.leg.br/dadosabertos/processo/9048130.json',
      fetchedAt: new Date('2026-09-06T21:00:00.000Z'),
    });

    await expect(materia.validate()).resolves.toBeUndefined();
  });
});
