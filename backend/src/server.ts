import 'dotenv/config';

import { buildApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { loadConfig } from './config/env.js';

const config = loadConfig(process.env);
const app = buildApp(config);
let isShuttingDown = false;

async function shutdown(): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  try {
    await app.close();
  } finally {
    await disconnectDatabase();
  }
}

process.once('SIGINT', () => {
  void shutdown().catch(() => {
    app.log.error('Falha ao encerrar a aplicação corretamente.');
    process.exitCode = 1;
  });
});

process.once('SIGTERM', () => {
  void shutdown().catch(() => {
    app.log.error('Falha ao encerrar a aplicação corretamente.');
    process.exitCode = 1;
  });
});

try {
  await connectDatabase({
    uri: config.mongodbUri,
    dbName: config.mongodbDbName,
  });
  app.log.info('MongoDB conectado com sucesso.');
} catch {
  app.log.error('Falha ao conectar ao MongoDB.');
}

try {
  await app.listen({ host: '0.0.0.0', port: config.port });
} catch {
  app.log.error('Não foi possível iniciar o servidor.');
  process.exitCode = 1;
  await shutdown();
}
