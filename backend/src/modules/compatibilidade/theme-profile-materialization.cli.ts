import { pathToFileURL } from 'node:url';

import 'dotenv/config';

import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import { loadConfig } from '../../config/env.js';
import { MaterializedThemeProfileRepository } from './materialized-theme-profile.repository.js';
import type {
  ThemeProfileMaterializationCliOptions,
  ThemeProfileMaterializationOptions,
} from './materialized-theme-profile.types.js';
import { ThemeProfileMaterializationService } from './theme-profile-materialization.service.js';
import { ThemeProfileRepository } from './theme-profile.repository.js';

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

export function parseThemeProfileMaterializationArgs(
  arguments_: string[],
): ThemeProfileMaterializationCliOptions {
  const source = valueOf(arguments_, '--source');
  const startYear = integer(arguments_, '--startYear');
  const endYear = integer(arguments_, '--endYear');
  const themeSource = valueOf(arguments_, '--themeSource');
  const batchSize = integer(arguments_, '--batch-size', 100);
  if (source !== 'CAMARA') throw new Error('--source deve ser CAMARA.');
  if (startYear < 1900 || endYear > 2100 || startYear > endYear) {
    throw new Error('Período inválido.');
  }
  if (!['official', 'enriched', 'all'].includes(themeSource ?? '')) {
    throw new Error('--themeSource deve ser official, enriched ou all.');
  }
  if (batchSize < 1 || batchSize > 500) {
    throw new Error('--batch-size deve estar entre 1 e 500.');
  }
  return {
    source,
    startYear,
    endYear,
    themeSource: themeSource as 'official' | 'enriched' | 'all',
    dryRun: arguments_.includes('--dry-run'),
    batchSize,
  };
}

async function main(): Promise<void> {
  const options = parseThemeProfileMaterializationArgs(process.argv.slice(2));
  const config = loadConfig(process.env);
  await connectDatabase({
    uri: config.mongodbUri,
    dbName: config.mongodbDbName,
  });
  try {
    const service = new ThemeProfileMaterializationService({
      sourceRepository: new ThemeProfileRepository(),
      materializedRepository: new MaterializedThemeProfileRepository(),
    });
    const modes =
      options.themeSource === 'all'
        ? (['official', 'enriched'] as const)
        : ([options.themeSource] as const);
    const summaries = [];
    for (const themeSource of modes) {
      const runOptions: ThemeProfileMaterializationOptions = {
        source: 'CAMARA',
        startYear: options.startYear,
        endYear: options.endYear,
        themeSource,
        dryRun: options.dryRun,
        batchSize: options.batchSize,
      };
      summaries.push(await service.run(runOptions));
    }
    console.log(JSON.stringify(summaries, null, 2));
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
