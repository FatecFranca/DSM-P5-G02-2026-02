import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import 'dotenv/config';

import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import { loadConfig } from '../../config/env.js';
import { HistoricalImportService } from './historical-import.service.js';
import type { HistoricalImportOptions } from './historical-import.types.js';

function argumentValue(arguments_: string[], name: string): string | undefined {
  const inline = arguments_.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = arguments_.indexOf(name);
  return index >= 0 ? arguments_[index + 1] : undefined;
}

function integerArgument(
  arguments_: string[],
  name: string,
  fallback?: number,
): number {
  const raw = argumentValue(arguments_, name);
  const value = raw === undefined ? fallback : Number(raw);
  if (value === undefined || !Number.isSafeInteger(value)) {
    throw new Error(`${name} deve ser um inteiro.`);
  }
  return value;
}

export function parseHistoricalImportArgs(
  arguments_: string[],
): HistoricalImportOptions {
  const startYear = integerArgument(arguments_, '--startYear');
  const endYear = integerArgument(arguments_, '--endYear');
  if (startYear < 2023 || endYear > 2025 || startYear > endYear) {
    throw new Error('O período deve estar contido entre 2023 a 2025.');
  }
  const batchSize = integerArgument(arguments_, '--batch-size', 500);
  if (batchSize < 1 || batchSize > 1_000) {
    throw new Error('--batch-size deve estar entre 1 e 1000.');
  }

  return {
    startYear,
    endYear,
    dataDir: resolve(
      argumentValue(arguments_, '--data-dir') ??
        resolve(process.cwd(), '..', 'ml', 'data', 'raw', 'camara'),
    ),
    dryRun: arguments_.includes('--dry-run'),
    batchSize,
  };
}

async function main(): Promise<void> {
  const options = parseHistoricalImportArgs(process.argv.slice(2));
  const config = loadConfig(process.env);
  await connectDatabase({
    uri: config.mongodbUri,
    dbName: config.mongodbDbName,
  });
  try {
    const summary = await new HistoricalImportService().run(options);
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
