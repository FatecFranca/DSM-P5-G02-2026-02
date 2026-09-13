import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import type { MLPrediction } from '../../integrations/ml/ml.types.js';
import type { MLServiceContract } from '../ml/ml.types.js';
import { MAX_ML_TEXT_LENGTH } from '../ml/ml.service.js';
import { SyncLogRepository } from '../sync/sync-log.repository.js';
import type { SyncLogRepositoryContract } from '../sync/sync.types.js';
import { getCamaraTheme } from '../temas/camara-temas.catalog.js';
import { MlThemeEnrichmentRepository } from './ml-theme-enrichment.repository.js';
import type {
  MlClassificationUpdate,
  MlEnrichmentCandidate,
  MlThemeEnrichmentOptions,
  MlThemeEnrichmentRepositoryContract,
  MlThemeEnrichmentSummary,
} from './ml-theme-enrichment.types.js';

interface MlThemeEnrichmentDependencies {
  repository?: MlThemeEnrichmentRepositoryContract;
  mlService: MLServiceContract;
  syncLogs?: SyncLogRepositoryContract;
  clock?: () => Date;
}

const MAX_REPORTED_ERRORS = 100;
const PAGE_SIZE = 500;

export function hashMlInput(text: string): string {
  return createHash('sha256').update(text.trim()).digest('hex');
}

function usableText(value: string | null): string | null {
  const text = value?.trim();
  return text && text.length <= MAX_ML_TEXT_LENGTH ? text : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro desconhecido.';
}

function validatePrediction(
  prediction: MLPrediction,
  modelName: string,
  modelVersion: string,
): void {
  if (
    prediction.model.source !== 'CAMARA' ||
    prediction.model.name !== modelName ||
    prediction.model.version !== modelVersion
  ) {
    throw new Error('Metadata da predição diverge do modelo ativo.');
  }
  const codes = prediction.labels.map(({ code }) => Number(code));
  if (
    codes.some(
      (code) => !Number.isSafeInteger(code) || !getCamaraTheme(code),
    ) ||
    new Set(codes).size !== codes.length
  ) {
    throw new Error('Predição contém código temático inválido ou duplicado.');
  }
}

export class MlThemeEnrichmentService {
  private readonly repository: MlThemeEnrichmentRepositoryContract;
  private readonly mlService: MLServiceContract;
  private readonly syncLogs: SyncLogRepositoryContract;
  private readonly clock: () => Date;

  constructor(dependencies: MlThemeEnrichmentDependencies) {
    this.repository =
      dependencies.repository ?? new MlThemeEnrichmentRepository();
    this.mlService = dependencies.mlService;
    this.syncLogs = dependencies.syncLogs ?? new SyncLogRepository();
    this.clock = dependencies.clock ?? (() => new Date());
  }

  async run(
    options: MlThemeEnrichmentOptions,
  ): Promise<MlThemeEnrichmentSummary> {
    const totalStarted = performance.now();
    const health = await this.mlService.health();
    const stats = await this.repository.countScope(options);
    const summary: MlThemeEnrichmentSummary = {
      ...stats,
      source: 'CAMARA',
      resource: 'ML_THEME_ENRICHMENT',
      period: {
        startYear: options.startYear,
        endYear: options.endYear,
      },
      modelName: health.modelName,
      modelVersion: health.modelVersion,
      dryRun: options.dryRun,
      status: 'SUCCESS',
      withUsableText: 0,
      withoutText: 0,
      alreadyProcessed: 0,
      pending: 0,
      attempted: 0,
      processed: 0,
      classifiedWithLabels: 0,
      processedWithoutLabel: 0,
      labelsGenerated: 0,
      skippedOfficialRace: 0,
      failures: 0,
      errors: [],
      performance: {
        totalMs: 0,
        predictionMs: 0,
        writeMs: 0,
        documentsPerSecond: 0,
      },
    };
    const startedAt = this.clock();
    const log = options.dryRun
      ? null
      : await this.syncLogs.start({
          source: 'CAMARA',
          resource: 'ML_THEME_ENRICHMENT',
          period: summary.period,
          startedAt,
        });

    try {
      let afterExternalId: number | undefined;
      let stop = false;
      while (!stop) {
        const page = await this.repository.listUncoveredPage({
          startYear: options.startYear,
          endYear: options.endYear,
          afterExternalId,
          limit: PAGE_SIZE,
        });
        if (page.length === 0) break;
        afterExternalId = page.at(-1)!.externalId;
        const pending: Array<{
          candidate: MlEnrichmentCandidate;
          text: string;
        }> = [];

        for (const candidate of page) {
          const text = usableText(candidate.ementa);
          if (!text) {
            summary.withoutText += 1;
            continue;
          }
          summary.withUsableText += 1;
          const inputHash = hashMlInput(text);
          if (
            candidate.mlClassification?.modelVersion === health.modelVersion &&
            candidate.mlClassification.modelName === health.modelName &&
            candidate.mlClassification.inputHash === inputHash
          ) {
            summary.alreadyProcessed += 1;
            continue;
          }
          summary.pending += 1;
          if (options.dryRun) continue;
          if (
            options.limit !== undefined &&
            summary.attempted + pending.length >= options.limit
          ) {
            stop = true;
            break;
          }
          pending.push({ candidate, text });
        }

        if (!options.dryRun) {
          for (
            let index = 0;
            index < pending.length;
            index += options.batchSize
          ) {
            await this.processBatch(
              pending.slice(index, index + options.batchSize),
              options,
              health.modelName,
              health.modelVersion,
              summary,
            );
          }
        }
        if (page.length < PAGE_SIZE) break;
      }

      summary.status = summary.failures > 0 ? 'PARTIAL' : 'SUCCESS';
      summary.performance.totalMs = performance.now() - totalStarted;
      summary.performance.documentsPerSecond =
        summary.performance.predictionMs === 0
          ? 0
          : summary.attempted / (summary.performance.predictionMs / 1_000);
      if (log) await this.finishLog(log.id, summary);
      return summary;
    } catch (error) {
      summary.status = 'PARTIAL';
      summary.errors.push(errorMessage(error));
      summary.performance.totalMs = performance.now() - totalStarted;
      if (log) await this.finishLog(log.id, summary, 'FAILED');
      throw error;
    }
  }

  private async processBatch(
    pending: Array<{ candidate: MlEnrichmentCandidate; text: string }>,
    options: MlThemeEnrichmentOptions,
    modelName: string,
    modelVersion: string,
    summary: MlThemeEnrichmentSummary,
  ): Promise<void> {
    const predictionStarted = performance.now();
    const updates: MlClassificationUpdate[] = [];
    let cursor = 0;
    const workers = Array.from(
      { length: Math.min(options.concurrency, pending.length) },
      async () => {
        while (cursor < pending.length) {
          const current = pending[cursor];
          cursor += 1;
          if (!current) continue;
          summary.attempted += 1;
          try {
            const prediction = await this.predictWithRetry(
              current.text,
              options.retries,
            );
            validatePrediction(prediction, modelName, modelVersion);
            const labels = prediction.labels.map((label) => {
              const code = Number(label.code);
              return {
                codTema: code,
                tema: getCamaraTheme(code)!.name,
                origin: 'ML' as const,
                decisionScore: label.decisionScore,
              };
            });
            summary.labelsGenerated += labels.length;
            updates.push({
              externalId: current.candidate.externalId,
              classification: {
                status: labels.length === 0 ? 'NO_LABEL' : 'CLASSIFIED',
                modelName: prediction.model.name,
                modelVersion: prediction.model.version,
                modelSource: 'CAMARA',
                modelYears: prediction.model.years,
                inputHash: hashMlInput(current.text),
                classifiedAt: this.clock(),
                labels,
              },
            });
          } catch (error) {
            summary.failures += 1;
            if (summary.errors.length < MAX_REPORTED_ERRORS) {
              summary.errors.push(
                `Proposição ${current.candidate.externalId}: ${errorMessage(error)}`,
              );
            }
          }
        }
      },
    );
    await Promise.all(workers);
    summary.performance.predictionMs += performance.now() - predictionStarted;
    if (updates.length === 0) return;

    const writeStarted = performance.now();
    const result = await this.repository.saveClassifications(updates);
    summary.performance.writeMs += performance.now() - writeStarted;
    summary.classifiedWithLabels += result.classified;
    summary.processedWithoutLabel += result.noLabel;
    summary.skippedOfficialRace += result.skippedOfficialRace;
    summary.processed += result.classified + result.noLabel;
  }

  private async predictWithRetry(
    text: string,
    retries: number,
  ): Promise<MLPrediction> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await this.mlService.predict(text);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  private async finishLog(
    id: string,
    summary: MlThemeEnrichmentSummary,
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED' = summary.status,
  ): Promise<void> {
    await this.syncLogs.finish(id, {
      finishedAt: this.clock(),
      status,
      processed: summary.processed,
      inserted: 0,
      updated: summary.processed,
      unchanged: summary.alreadyProcessed,
      errors: summary.errors,
    });
  }
}
