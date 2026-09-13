import mongoose from 'mongoose';

export type DatabaseStatus = 'connected' | 'disconnected';

interface DatabaseConnection {
  readonly readyState: number;
  asPromise(): Promise<unknown>;
}

export interface DatabaseAdapter {
  readonly connection: DatabaseConnection;
  connect(
    uri: string,
    options: { dbName: string; serverSelectionTimeoutMS: number },
  ): Promise<unknown>;
  disconnect(): Promise<void>;
}

export interface DatabaseConfig {
  uri: string;
  dbName: string;
}

const defaultAdapter: DatabaseAdapter = {
  connection: mongoose.connection,
  connect: async (uri, options) => mongoose.connect(uri, options),
  disconnect: async () => mongoose.disconnect(),
};

export function getDatabaseStatus(
  connection: Pick<
    DatabaseConnection,
    'readyState'
  > = defaultAdapter.connection,
): DatabaseStatus {
  return connection.readyState === 1 ? 'connected' : 'disconnected';
}

export async function connectDatabase(
  config: DatabaseConfig,
  adapter: DatabaseAdapter = defaultAdapter,
): Promise<void> {
  try {
    if (adapter.connection.readyState === 1) {
      return;
    }

    if (adapter.connection.readyState === 2) {
      await adapter.connection.asPromise();
      return;
    }

    await adapter.connect(config.uri, {
      dbName: config.dbName,
      serverSelectionTimeoutMS: 10_000,
    });
  } catch (cause) {
    throw new Error('Falha ao conectar ao MongoDB.', { cause });
  }
}

export async function disconnectDatabase(
  adapter: DatabaseAdapter = defaultAdapter,
): Promise<void> {
  if (adapter.connection.readyState === 0) {
    return;
  }

  await adapter.disconnect();
}
