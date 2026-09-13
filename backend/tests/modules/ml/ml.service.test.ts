import { describe, expect, it } from 'vitest';

import { MLUnavailableError } from '../../../src/integrations/ml/ml.errors.js';
import type { MLGateway } from '../../../src/integrations/ml/ml.types.js';
import { MLService } from '../../../src/modules/ml/ml.service.js';
import { MLInvalidTextError } from '../../../src/modules/ml/ml.errors.js';
import { mlHealthFixture, mlPredictionFixture } from '../../fixtures/ml.js';

describe('MLService', () => {
  it('delega health e predict sem alterar labels ou decisionScore', async () => {
    const received: string[] = [];
    const gateway: MLGateway = {
      health: () => Promise.resolve(mlHealthFixture),
      predict: (text) => {
        received.push(text);
        return Promise.resolve(mlPredictionFixture);
      },
    };
    const service = new MLService(gateway);

    await expect(service.health()).resolves.toEqual(mlHealthFixture);
    await expect(service.predict('  Texto original.  ')).resolves.toEqual(
      mlPredictionFixture,
    );
    expect(received).toEqual(['  Texto original.  ']);
  });

  it('preserva resposta com zero labels', async () => {
    const gateway: MLGateway = {
      health: () => Promise.resolve(mlHealthFixture),
      predict: () =>
        Promise.resolve({ ...mlPredictionFixture, labels: [], labelCount: 0 }),
    };

    await expect(
      new MLService(gateway).predict('Texto válido.'),
    ).resolves.toEqual(expect.objectContaining({ labels: [], labelCount: 0 }));
  });

  it.each(['', '   \n', 'a'.repeat(5001)])(
    'rejeita texto inválido antes do gateway',
    async (text) => {
      const gateway: MLGateway = {
        health: () => Promise.resolve(mlHealthFixture),
        predict: () => Promise.reject(new Error('Não deveria chamar gateway.')),
      };

      await expect(new MLService(gateway).predict(text)).rejects.toBeInstanceOf(
        MLInvalidTextError,
      );
    },
  );

  it('propaga erro técnico tipado do client', async () => {
    const error = new MLUnavailableError();
    const gateway: MLGateway = {
      health: () => Promise.reject(error),
      predict: () => Promise.reject(error),
    };

    await expect(new MLService(gateway).predict('Texto válido.')).rejects.toBe(
      error,
    );
  });
});
