import { pathToFileURL } from 'node:url';

import 'dotenv/config';

import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import { loadConfig } from '../../config/env.js';
import { MLClient } from '../../integrations/ml/ml.client.js';
import { MLService } from '../ml/ml.service.js';
import { MlThemeEnrichmentService } from './ml-theme-enrichment.service.js';
import type { MlThemeEnrichmentOptions } from './ml-theme-enrichment.types.js';

function valueOf(arguments_: string[], name: string): string | undefined {
  const inline = arguments_.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = arguments_.indexOf(name);
  return index === -1 ? undefined : arguments_[index + 1];
}

function integer(
  arguments_: string[],
  name: string,
  fallback?: number,
): number {
  const raw = valueOf(arguments_, name);
  const value = raw === undefined ? fallback : Number(raw);
  if (value === undefined || !Number.isSafeInteger(value)) {
    throw new Error(`${name} deve ser um inteiro.`);
  }
  return value;
}

export function parseMlThemeEnrichmentArgs(
  arguments_: string[],
): MlThemeEnrichmentOptions {
  const startYear = integer(arguments_, '--startYear');
  const endYear = integer(arguments_, '--endYear');
  if (startYear < 2023 || endYear > 2025 || startYear > endYear) {
    throw new Error('O período deve estar contido entre 2023 e 2025.');
  }
  const concurrency = integer(arguments_, '--concurrency', 5);
  const batchSize = integer(arguments_, '--batch-size', 100);
  const retries = integer(arguments_, '--retries', 1);
  const rawLimit = valueOf(arguments_, '--limit');
  const limit = rawLimit === undefined ? undefined : Number(rawLimit);
  if (concurrency < 1 || concurrency > 20) {
    throw new Error('--concurrency deve estar entre 1 e 20.');
  }
  if (batchSize < 1 || batchSize > 500) {
    throw new Error('--batch-size deve estar entre 1 e 500.');
  }
  if (retries < 0 || retries > 2) {
    throw new Error('--retries deve estar entre 0 e 2.');
  }
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1)) {
    throw new Error('--limit deve ser um inteiro positivo.');
  }
  return {
    startYear,
    endYear,
    dryRun: arguments_.includes('--dry-run'),
    ...(limit === undefined ? {} : { limit }),
    concurrency,
    batchSize,
    retries,
  };
}

async function main(): Promise<void> {
  const options = parseMlThemeEnrichmentArgs(process.argv.slice(2));
  const config = loadConfig(process.env);
  await connectDatabase({
    uri: config.mongodbUri,
    dbName: config.mongodbDbName,
  });
  try {
    const client = new MLClient({ baseUrl: config.mlServiceUrl });
    const summary = await new MlThemeEnrichmentService({
      mlService: new MLService(client),
    }).run(options);
    console.log(JSON.stringify(summary, null, 2));
    if (summary.status !== 'SUCCESS') process.exitCode = 2;
  } finally {
    await disconnectDatabase();
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
