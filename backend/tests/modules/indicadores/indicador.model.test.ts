import { describe, expect, it } from 'vitest';

import {
  ParticipacaoOrgaoModel,
  VotacaoModel,
  VotoModel,
} from '../../../src/modules/indicadores/indicador.model.js';

describe('models de indicadores', () => {
  it('usa collections específicas e identidades compostas', () => {
    expect(VotacaoModel.collection.collectionName).toBe('votacoes');
    expect(VotoModel.collection.collectionName).toBe('votos');
    expect(ParticipacaoOrgaoModel.collection.collectionName).toBe(
      'participacoes_orgaos',
    );
    expect(VotacaoModel.schema.indexes()).toContainEqual([
      { source: 1, externalId: 1 },
      { unique: true },
    ]);
    expect(VotoModel.schema.indexes()).toContainEqual([
      { source: 1, votacaoExternalId: 1, parlamentarExternalId: 1 },
      { unique: true },
    ]);
    expect(ParticipacaoOrgaoModel.schema.indexes()).toContainEqual([
      {
        source: 1,
        parlamentarExternalId: 1,
        orgaoExternalId: 1,
        funcao: 1,
        inicio: 1,
      },
      { unique: true },
    ]);
  });

  it.each(['CAMARA', 'SENADO'] as const)('aceita source %s', async (source) => {
    const votacao = new VotacaoModel({
      source,
      externalId: '123-1',
      data: new Date('2026-06-17T00:00:00.000Z'),
      casa: source,
      fetchedAt: new Date(),
    });

    await expect(votacao.validate()).resolves.toBeUndefined();
  });
});
