import type { Model } from 'mongoose';
import { describe, expect, it } from 'vitest';

import type { MLServiceContract } from '../../../src/modules/ml/ml.types.js';
import {
  hashMlInput,
  MlThemeEnrichmentService,
} from '../../../src/modules/ml-theme-enrichment/ml-theme-enrichment.service.js';
import { MlThemeEnrichmentRepository } from '../../../src/modules/ml-theme-enrichment/ml-theme-enrichment.repository.js';
import { parseMlThemeEnrichmentArgs } from '../../../src/modules/ml-theme-enrichment/ml-theme-enrichment.cli.js';
import type {
  MlClassificationUpdate,
  MlEnrichmentCandidate,
  MlThemeEnrichmentRepositoryContract,
  MlThemeSelectionStats,
} from '../../../src/modules/ml-theme-enrichment/ml-theme-enrichment.types.js';
import type { ProposicaoPersistence } from '../../../src/modules/proposicoes/proposicao.model.js';
import type {
  FinishSyncLogInput,
  StartSyncLogInput,
  SyncLogRepositoryContract,
} from '../../../src/modules/sync/sync.types.js';
import { mlHealthFixture, mlPredictionFixture } from '../../fixtures/ml.js';

const classifiedAt = new Date('2026-09-11T12:00:00.000Z');

class InMemoryEnrichmentRepository implements MlThemeEnrichmentRepositoryContract {
  readonly writes: MlClassificationUpdate[][] = [];

  constructor(
    readonly candidates: MlEnrichmentCandidate[],
    private readonly stats: MlThemeSelectionStats = {
      propositionsTotal: 7,
      official: 1,
      uncovered: 6,
    },
  ) {}

  countScope() {
    return Promise.resolve(this.stats);
  }

  listUncoveredPage(query: { afterExternalId?: number; limit: number }) {
    return Promise.resolve(
      this.candidates
        .filter(
          ({ externalId }) =>
            query.afterExternalId === undefined ||
            externalId > query.afterExternalId,
        )
        .slice(0, query.limit),
    );
  }

  saveClassifications(updates: MlClassificationUpdate[]) {
    this.writes.push(updates);
    for (const update of updates) {
      const candidate = this.candidates.find(
        ({ externalId }) => externalId === update.externalId,
      );
      if (candidate) candidate.mlClassification = update.classification;
    }
    return Promise.resolve({
      classified: updates.filter(
        ({ classification }) => classification.status === 'CLASSIFIED',
      ).length,
      noLabel: updates.filter(
        ({ classification }) => classification.status === 'NO_LABEL',
      ).length,
      skippedOfficialRace: 0,
    });
  }
}

class InMemorySyncLogs implements SyncLogRepositoryContract {
  readonly started: StartSyncLogInput[] = [];
  readonly finished: FinishSyncLogInput[] = [];

  start(input: StartSyncLogInput) {
    this.started.push(input);
    return Promise.resolve({ id: 'ml-enrichment-1' });
  }

  finish(_id: string, input: FinishSyncLogInput) {
    this.finished.push(input);
    return Promise.resolve();
  }
}

function candidate(
  externalId: number,
  ementa: string | null,
): MlEnrichmentCandidate {
  return { externalId, ementa, mlClassification: null };
}

function successfulMlService(): MLServiceContract {
  return {
    health: () => Promise.resolve(mlHealthFixture),
    predict: (text) =>
      Promise.resolve(
        text.includes('sem label')
          ? { ...mlPredictionFixture, labels: [], labelCount: 0 }
          : mlPredictionFixture,
      ),
  };
}

describe('MlThemeEnrichmentService', () => {
  it('faz dry-run sem predição ou escrita e separa seleção por estado', async () => {
    let predictions = 0;
    const mlService = successfulMlService();
    mlService.predict = () => {
      predictions += 1;
      return Promise.resolve(mlPredictionFixture);
    };
    const alreadyClassified = candidate(4, 'Texto já classificado.');
    alreadyClassified.mlClassification = {
      status: 'CLASSIFIED',
      modelName: 'linear_svc_balanced',
      modelVersion: 'experimental-1',
      modelSource: 'CAMARA',
      modelYears: [2023, 2024, 2025],
      inputHash: hashMlInput(alreadyClassified.ementa!),
      classifiedAt,
      labels: [
        {
          codTema: 56,
          tema: 'Saúde',
          origin: 'ML',
          decisionScore: 2.3634,
        },
      ],
    };
    const repository = new InMemoryEnrichmentRepository([
      candidate(1, 'Texto pendente.'),
      candidate(2, null),
      candidate(3, '   '),
      alreadyClassified,
      candidate(5, 'x'.repeat(5_001)),
      candidate(6, 'Outro texto pendente.'),
    ]);
    const logs = new InMemorySyncLogs();
    const service = new MlThemeEnrichmentService({
      repository,
      mlService,
      syncLogs: logs,
      clock: () => classifiedAt,
    });

    const result = await service.run({
      startYear: 2023,
      endYear: 2025,
      dryRun: true,
      concurrency: 2,
      batchSize: 2,
      retries: 1,
    });

    expect(result).toMatchObject({
      propositionsTotal: 7,
      official: 1,
      uncovered: 6,
      withUsableText: 3,
      withoutText: 3,
      alreadyProcessed: 1,
      pending: 2,
      processed: 0,
    });
    expect(predictions).toBe(0);
    expect(repository.writes).toEqual([]);
    expect(logs.started).toEqual([]);
  });

  it('preserva decisionScore, multi-label e zero-label em batches limitados', async () => {
    const repository = new InMemoryEnrichmentRepository([
      candidate(1, 'Texto com múltiplos temas.'),
      candidate(2, 'Texto sem label.'),
      candidate(3, 'Outro texto com temas.'),
    ]);
    const logs = new InMemorySyncLogs();
    const service = new MlThemeEnrichmentService({
      repository,
      mlService: successfulMlService(),
      syncLogs: logs,
      clock: () => classifiedAt,
    });

    const result = await service.run({
      startYear: 2023,
      endYear: 2025,
      dryRun: false,
      concurrency: 2,
      batchSize: 2,
      retries: 0,
    });

    expect(result).toMatchObject({
      processed: 3,
      classifiedWithLabels: 2,
      processedWithoutLabel: 1,
      labelsGenerated: 4,
      failures: 0,
    });
    expect(repository.writes.map((batch) => batch.length)).toEqual([2, 1]);
    expect(repository.writes[0]?.[0]?.classification.labels[0]).toEqual({
      codTema: 56,
      tema: 'Saúde',
      origin: 'ML',
      decisionScore: 2.3634,
    });
    expect(repository.writes[0]?.[0]?.classification).not.toHaveProperty(
      'confidence',
    );
    expect(repository.writes[0]?.[1]?.classification).toMatchObject({
      status: 'NO_LABEL',
      labels: [],
    });
    expect(logs.started[0]).toMatchObject({
      source: 'CAMARA',
      resource: 'ML_THEME_ENRICHMENT',
      period: { startYear: 2023, endYear: 2025 },
    });
  });

  it('limita concorrência e repete uma falha transitória uma vez', async () => {
    let active = 0;
    let maximumActive = 0;
    let attempts = 0;
    const attemptsByText = new Map<string, number>();
    const mlService: MLServiceContract = {
      health: () => Promise.resolve(mlHealthFixture),
      predict: async (text) => {
        attempts += 1;
        attemptsByText.set(text, (attemptsByText.get(text) ?? 0) + 1);
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        if (text === 'Texto 1.' && attemptsByText.get(text) === 1) {
          throw new Error('Falha transitória.');
        }
        return mlPredictionFixture;
      },
    };
    const repository = new InMemoryEnrichmentRepository([
      candidate(1, 'Texto 1.'),
      candidate(2, 'Texto 2.'),
      candidate(3, 'Texto 3.'),
    ]);

    const result = await new MlThemeEnrichmentService({
      repository,
      mlService,
      syncLogs: new InMemorySyncLogs(),
      clock: () => classifiedAt,
    }).run({
      startYear: 2023,
      endYear: 2025,
      dryRun: false,
      concurrency: 2,
      batchSize: 3,
      retries: 1,
    });

    expect(maximumActive).toBe(2);
    expect(attempts).toBe(4);
    expect(result.failures).toBe(0);
  });

  it('não marca falha permanente e permite retomada', async () => {
    let fail = true;
    const mlService = successfulMlService();
    mlService.predict = () =>
      fail
        ? Promise.reject(new Error('Serviço indisponível.'))
        : Promise.resolve(mlPredictionFixture);
    const repository = new InMemoryEnrichmentRepository([
      candidate(1, 'Texto recuperável.'),
    ]);
    const service = new MlThemeEnrichmentService({
      repository,
      mlService,
      syncLogs: new InMemorySyncLogs(),
      clock: () => classifiedAt,
    });
    const options = {
      startYear: 2023,
      endYear: 2025,
      dryRun: false,
      concurrency: 1,
      batchSize: 1,
      retries: 1,
    };

    const failed = await service.run(options);
    fail = false;
    const resumed = await service.run(options);
    const idempotent = await service.run(options);

    expect(failed).toMatchObject({ failures: 1, processed: 0 });
    expect(resumed).toMatchObject({ failures: 0, processed: 1 });
    expect(idempotent).toMatchObject({
      processed: 0,
      alreadyProcessed: 1,
      pending: 0,
    });
  });
});

describe('MlThemeEnrichmentRepository', () => {
  it('seleciona somente Câmara sem tema oficial usando keyset', async () => {
    const exec = () =>
      Promise.resolve([
        { externalId: 11, ementa: 'Texto', mlClassification: null },
      ]);
    const lean = () => ({ exec });
    const limit = () => ({ lean });
    const sort = () => ({ limit });
    let filter: unknown;
    const find = (received: unknown) => {
      filter = received;
      return { sort };
    };
    const repository = new MlThemeEnrichmentRepository({
      find,
    } as unknown as Model<ProposicaoPersistence>);

    await repository.listUncoveredPage({
      startYear: 2023,
      endYear: 2025,
      afterExternalId: 10,
      limit: 100,
    });

    expect(filter).toEqual({
      source: 'CAMARA',
      ano: { $gte: 2023, $lte: 2025 },
      'temasOficiais.0': { $exists: false },
      externalId: { $gt: 10 },
    });
  });

  it('faz update condicional sem upsert para nunca vencer tema oficial', async () => {
    let operations: unknown;
    const bulkWrite = (received: unknown) => {
      operations = received;
      return Promise.resolve({ matchedCount: 1 });
    };
    const repository = new MlThemeEnrichmentRepository({
      bulkWrite,
    } as unknown as Model<ProposicaoPersistence>);
    const classification: MlClassificationUpdate['classification'] = {
      status: 'CLASSIFIED',
      modelName: 'linear_svc_balanced',
      modelVersion: 'experimental-1',
      modelSource: 'CAMARA',
      modelYears: [2023, 2024, 2025],
      inputHash: 'hash',
      classifiedAt,
      labels: [
        {
          codTema: 56,
          tema: 'Saúde',
          origin: 'ML',
          decisionScore: 2.3634,
        },
      ],
    };

    await repository.saveClassifications([{ externalId: 1, classification }]);

    expect(operations).toEqual([
      {
        updateOne: {
          filter: {
            source: 'CAMARA',
            externalId: 1,
            'temasOficiais.0': { $exists: false },
          },
          update: { $set: { mlClassification: classification } },
          upsert: false,
        },
      },
    ]);
  });
});

describe('CLI de enriquecimento temático', () => {
  it('valida limites e opções operacionais', () => {
    expect(
      parseMlThemeEnrichmentArgs([
        '--startYear=2023',
        '--endYear=2025',
        '--dry-run',
        '--limit=100',
        '--concurrency=5',
        '--batch-size=100',
      ]),
    ).toEqual({
      startYear: 2023,
      endYear: 2025,
      dryRun: true,
      limit: 100,
      concurrency: 5,
      batchSize: 100,
      retries: 1,
    });
  });
});
