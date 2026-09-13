import { describe, expect, it } from 'vitest';

import { SyncLogModel } from '../../../src/modules/sync/sync-log.model.js';

describe('SyncLogModel', () => {
  it('utiliza a collection sync_logs', () => {
    expect(SyncLogModel.collection.collectionName).toBe('sync_logs');
  });

  it('mantém compatibilidade com logs antigos usando zero como padrão', () => {
    const log = new SyncLogModel({
      source: 'CAMARA',
      resource: 'DEPUTADOS',
      startedAt: new Date('2026-09-05T12:00:00.000Z'),
      status: 'RUNNING',
      processed: 0,
      inserted: 0,
      updated: 0,
      errors: [],
    });

    expect(log.unchanged).toBe(0);
  });

  it('aceita o resource PROPOSICOES no mesmo sistema de logs', async () => {
    const log = new SyncLogModel({
      source: 'CAMARA',
      resource: 'PROPOSICOES',
      startedAt: new Date('2026-09-05T12:00:00.000Z'),
      status: 'RUNNING',
    });

    await expect(log.validate()).resolves.toBeUndefined();
  });

  it('aceita importação histórica com período explícito', async () => {
    const log = new SyncLogModel({
      source: 'CAMARA',
      resource: 'HISTORICAL_PROPOSITIONS',
      period: { startYear: 2023, endYear: 2025 },
      startedAt: new Date('2026-09-10T12:00:00.000Z'),
      status: 'RUNNING',
    });

    await expect(log.validate()).resolves.toBeUndefined();
    expect(log.toObject().period).toEqual({
      startYear: 2023,
      endYear: 2025,
    });
  });

  it('aceita enriquecimento ML da Câmara com período explícito', async () => {
    const log = new SyncLogModel({
      source: 'CAMARA',
      resource: 'ML_THEME_ENRICHMENT',
      period: { startYear: 2023, endYear: 2025 },
      startedAt: new Date('2026-09-11T12:00:00.000Z'),
      status: 'RUNNING',
    });

    await expect(log.validate()).resolves.toBeUndefined();
  });

  it('aceita sincronização SENADO + SENADORES', async () => {
    const log = new SyncLogModel({
      source: 'SENADO',
      resource: 'SENADORES',
      startedAt: new Date('2026-09-06T20:00:00.000Z'),
      status: 'RUNNING',
    });

    await expect(log.validate()).resolves.toBeUndefined();
  });

  it('aceita sincronização SENADO + MATERIAS', async () => {
    const log = new SyncLogModel({
      source: 'SENADO',
      resource: 'MATERIAS',
      startedAt: new Date('2026-09-06T21:00:00.000Z'),
      status: 'RUNNING',
    });

    await expect(log.validate()).resolves.toBeUndefined();
  });

  it('aceita o resource INDICADORES para as duas Casas', async () => {
    const logs = ['CAMARA', 'SENADO'].map(
      (source) =>
        new SyncLogModel({
          source,
          resource: 'INDICADORES',
          startedAt: new Date('2026-09-07T12:00:00.000Z'),
          status: 'RUNNING',
        }),
    );

    await expect(
      Promise.all(logs.map((log) => log.validate())),
    ).resolves.toEqual([undefined, undefined]);
  });
});
