import { describe, expect, it } from 'vitest';

import {
  connectDatabase,
  disconnectDatabase,
  getDatabaseStatus,
  type DatabaseAdapter,
} from '../../src/config/database.js';

function createAdapter(readyState: number): DatabaseAdapter {
  return {
    connection: {
      readyState,
      asPromise: () => Promise.resolve(undefined),
    },
    connect: () => Promise.resolve(undefined),
    disconnect: () => Promise.resolve(undefined),
  };
}

const databaseConfig = {
  uri: 'mongodb://example.invalid',
  dbName: 'pi_parlamentar',
};

describe('getDatabaseStatus', () => {
  it('retorna connected somente para uma conexão pronta', () => {
    expect(getDatabaseStatus(createAdapter(1).connection)).toBe('connected');
  });

  it.each([0, 2, 3])(
    'retorna disconnected para o readyState %i',
    (readyState) => {
      expect(getDatabaseStatus(createAdapter(readyState).connection)).toBe(
        'disconnected',
      );
    },
  );
});

describe('connectDatabase', () => {
  it('reutiliza uma conexão que já está pronta', async () => {
    let connectWasCalled = false;
    const adapter = createAdapter(1);
    adapter.connect = () => {
      connectWasCalled = true;
      return Promise.resolve(undefined);
    };

    await connectDatabase(databaseConfig, adapter);

    expect(connectWasCalled).toBe(false);
  });

  it('aguarda uma conexão que já está em andamento', async () => {
    let existingConnectionWasAwaited = false;
    const adapter = createAdapter(2);
    adapter.connection.asPromise = () => {
      existingConnectionWasAwaited = true;
      return Promise.resolve(undefined);
    };

    await connectDatabase(databaseConfig, adapter);

    expect(existingConnectionWasAwaited).toBe(true);
  });

  it('retorna uma mensagem segura quando a conexão falha', async () => {
    const adapter = createAdapter(0);
    adapter.connect = () =>
      Promise.reject(new Error('mongodb://usuario:segredo@cluster.example'));

    await expect(connectDatabase(databaseConfig, adapter)).rejects.toThrowError(
      'Falha ao conectar ao MongoDB.',
    );
  });
});

describe('disconnectDatabase', () => {
  it('não solicita desconexão quando a conexão já está fechada', async () => {
    let disconnectWasCalled = false;
    const adapter = createAdapter(0);
    adapter.disconnect = () => {
      disconnectWasCalled = true;
      return Promise.resolve(undefined);
    };

    await disconnectDatabase(adapter);

    expect(disconnectWasCalled).toBe(false);
  });
});
