import { describe, expect, it } from 'vitest';

import {
  ParlamentarModel,
  parlamentarSchema,
} from '../../../src/modules/parlamentares/parlamentar.model.js';

describe('parlamentarSchema', () => {
  it('impede duplicação pela identidade externa composta', () => {
    const indexes = parlamentarSchema.indexes();

    expect(indexes).toContainEqual([
      { source: 1, externalId: 1 },
      { unique: true },
    ]);
  });

  it('aceita senador na mesma collection de parlamentares', async () => {
    const senator = new ParlamentarModel({
      externalId: 5672,
      source: 'SENADO',
      casa: 'SENADO',
      nome: 'Senadora Fictícia',
      partido: null,
      uf: null,
      fotoUrl: null,
      email: null,
      legislatura: null,
      fetchedAt: new Date('2026-09-06T20:00:00.000Z'),
    });

    await expect(senator.validate()).resolves.toBeUndefined();
    expect(ParlamentarModel.collection.collectionName).toBe('parlamentares');
  });
});
