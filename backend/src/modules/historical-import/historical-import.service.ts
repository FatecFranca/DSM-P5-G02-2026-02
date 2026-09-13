import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import { ParlamentarModel } from '../parlamentares/parlamentar.model.js';
import { ProposicaoRepository } from '../proposicoes/proposicao.repository.js';
import type {
  ProposicaoInput,
  ProposicaoRepositoryContract,
  ProposicaoWriteResult,
} from '../proposicoes/proposicao.types.js';
import { SyncLogRepository } from '../sync/sync-log.repository.js';
import type { SyncLogRepositoryContract } from '../sync/sync.types.js';
import {
  parseHistoricalAuthorRow,
  parseHistoricalPropositionRow,
  parseHistoricalThemeRow,
  streamCsvRows,
} from './historical-csv.js';
import type {
  HistoricalAuthorRow,
  HistoricalImportOptions,
  HistoricalImportSummary,
  HistoricalYearSummary,
} from './historical-import.types.js';

interface HistoricalImportDependencies {
  propositionRepository?: ProposicaoRepositoryContract;
  syncLogs?: SyncLogRepositoryContract;
  listKnownDeputyIds?: () => Promise<ReadonlySet<number>>;
  clock?: () => Date;
}

interface PropositionJoin {
  proposition: ProposicaoInput;
  authors: HistoricalAuthorRow[];
  themeCodes: Set<number>;
}

const MAX_REPORTED_ERRORS = 100;

function emptyYearSummary(year: number): HistoricalYearSummary {
  return {
    year,
    propositions: 0,
    propositionsWithThemes: 0,
    propositionsWithoutThemes: 0,
    propositionsWithDeputy: 0,
    propositionsWithoutDeputy: 0,
    associations: 0,
  };
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro desconhecido.';
}

export class HistoricalImportService {
  private readonly propositionRepository: ProposicaoRepositoryContract;
  private readonly syncLogs: SyncLogRepositoryContract;
  private readonly listKnownDeputyIds: () => Promise<ReadonlySet<number>>;
  private readonly clock: () => Date;

  constructor(dependencies: HistoricalImportDependencies = {}) {
    this.propositionRepository =
      dependencies.propositionRepository ?? new ProposicaoRepository();
    this.syncLogs = dependencies.syncLogs ?? new SyncLogRepository();
    this.listKnownDeputyIds =
      dependencies.listKnownDeputyIds ??
      (async () => {
        const ids = await ParlamentarModel.distinct('externalId', {
          source: 'CAMARA',
        }).exec();
        return new Set(ids.filter(Number.isSafeInteger));
      });
    this.clock = dependencies.clock ?? (() => new Date());
  }

  async run(
    options: HistoricalImportOptions,
  ): Promise<HistoricalImportSummary> {
    const totalStarted = performance.now();
    const startedAt = this.clock();
    const knownDeputyIds = await this.listKnownDeputyIds();
    const years = Array.from(
      { length: options.endYear - options.startYear + 1 },
      (_, index) => emptyYearSummary(options.startYear + index),
    );
    const summary: HistoricalImportSummary = {
      source: 'CAMARA',
      resource: 'HISTORICAL_PROPOSITIONS',
      period: {
        startYear: options.startYear,
        endYear: options.endYear,
      },
      dryRun: options.dryRun,
      status: 'SUCCESS',
      propositionsRead: 0,
      propositionsValid: 0,
      themesRead: 0,
      authorsRead: 0,
      parliamentaryAuthors: 0,
      parliamentaryAuthorsResolved: 0,
      parliamentaryAuthorsUnresolved: 0,
      nonParliamentaryAuthors: 0,
      associations: 0,
      propositionsWithThemes: 0,
      propositionsWithoutThemes: 0,
      propositionsWithDeputy: 0,
      propositionsWithoutDeputy: 0,
      estimatedUpserts: 0,
      processed: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      invalidRows: 0,
      errors: [],
      years,
      performance: { readAndParseMs: 0, writeMs: 0, totalMs: 0 },
    };
    const log = options.dryRun
      ? null
      : await this.syncLogs.start({
          source: 'CAMARA',
          resource: 'HISTORICAL_PROPOSITIONS',
          period: summary.period,
          startedAt,
        });

    try {
      const seenPropositionIds = new Set<number>();
      for (
        let partitionYear = options.startYear;
        partitionYear <= options.endYear;
        partitionYear += 1
      ) {
        await this.processPartition(
          partitionYear,
          options,
          knownDeputyIds,
          seenPropositionIds,
          summary,
        );
      }
      summary.status = summary.invalidRows > 0 ? 'PARTIAL' : 'SUCCESS';
      summary.performance.totalMs = performance.now() - totalStarted;
      summary.performance.readAndParseMs =
        summary.performance.totalMs - summary.performance.writeMs;

      if (log) {
        await this.syncLogs.finish(log.id, {
          finishedAt: this.clock(),
          status: summary.status,
          processed: summary.processed,
          inserted: summary.inserted,
          updated: summary.updated,
          unchanged: summary.unchanged,
          errors: summary.errors,
        });
      }
      return summary;
    } catch (error) {
      summary.performance.totalMs = performance.now() - totalStarted;
      if (log) {
        await this.syncLogs.finish(log.id, {
          finishedAt: this.clock(),
          status: 'FAILED',
          processed: summary.processed,
          inserted: summary.inserted,
          updated: summary.updated,
          unchanged: summary.unchanged,
          errors: [...summary.errors, messageFrom(error)].slice(
            0,
            MAX_REPORTED_ERRORS,
          ),
        });
      }
      throw error;
    }
  }

  private async processPartition(
    partitionYear: number,
    options: HistoricalImportOptions,
    knownDeputyIds: ReadonlySet<number>,
    seenPropositionIds: Set<number>,
    summary: HistoricalImportSummary,
  ): Promise<void> {
    const records = new Map<number, PropositionJoin>();
    const propositionPath = resolve(
      options.dataDir,
      'proposicoes',
      `proposicoes-${partitionYear}.csv`,
    );
    for await (const row of streamCsvRows(propositionPath)) {
      summary.propositionsRead += 1;
      try {
        const proposition = parseHistoricalPropositionRow(
          row.values,
          row.line,
          this.clock(),
        );
        if (
          proposition.ano < options.startYear ||
          proposition.ano > options.endYear
        ) {
          continue;
        }
        if (seenPropositionIds.has(proposition.externalId)) {
          throw new Error(
            `Proposição ${proposition.externalId} repetida entre partições.`,
          );
        }
        seenPropositionIds.add(proposition.externalId);
        records.set(proposition.externalId, {
          proposition,
          authors: [],
          themeCodes: new Set(),
        });
        summary.propositionsValid += 1;
      } catch (error) {
        this.recordError(summary, `${propositionPath}: ${messageFrom(error)}`);
      }
    }

    const themesPath = resolve(
      options.dataDir,
      'temas',
      `proposicoesTemas-${partitionYear}.csv`,
    );
    for await (const row of streamCsvRows(themesPath)) {
      summary.themesRead += 1;
      try {
        const theme = parseHistoricalThemeRow(row.values, row.line);
        const target = records.get(theme.propositionId);
        if (!target || target.themeCodes.has(theme.code)) continue;
        target.themeCodes.add(theme.code);
        target.proposition.temasOficiais.push({
          codTema: theme.code,
          tema: theme.name,
        });
      } catch (error) {
        this.recordError(summary, `${themesPath}: ${messageFrom(error)}`);
      }
    }

    const authorsPath = resolve(
      options.dataDir,
      'autores',
      `proposicoesAutores-${partitionYear}.csv`,
    );
    for await (const row of streamCsvRows(authorsPath)) {
      summary.authorsRead += 1;
      try {
        const author = parseHistoricalAuthorRow(row.values, row.line);
        const target = records.get(author.propositionId);
        if (!target) continue;
        if (author.deputyId === null) {
          summary.nonParliamentaryAuthors += 1;
        } else {
          summary.parliamentaryAuthors += 1;
          if (knownDeputyIds.has(author.deputyId)) {
            author.author.parlamentarExternalId = author.deputyId;
            summary.parliamentaryAuthorsResolved += 1;
          } else {
            summary.parliamentaryAuthorsUnresolved += 1;
          }
        }
        target.authors.push(author);
      } catch (error) {
        this.recordError(summary, `${authorsPath}: ${messageFrom(error)}`);
      }
    }

    const propositions = [...records.values()].map((record) => {
      record.proposition.autores = record.authors
        .sort(
          (left, right) =>
            left.signatureOrder - right.signatureOrder ||
            Number(right.proponent) - Number(left.proponent) ||
            (left.author.externalId ?? Number.MAX_SAFE_INTEGER) -
              (right.author.externalId ?? Number.MAX_SAFE_INTEGER),
        )
        .map(({ author }) => author);
      record.proposition.temasOficiais.sort(
        (left, right) =>
          left.codTema - right.codTema ||
          left.tema.localeCompare(right.tema, 'pt-BR'),
      );
      this.accountProposition(record.proposition, summary);
      return record.proposition;
    });
    summary.estimatedUpserts += propositions.length;
    summary.processed += propositions.length;

    if (!options.dryRun) {
      for (
        let index = 0;
        index < propositions.length;
        index += options.batchSize
      ) {
        const writeStarted = performance.now();
        const result = await this.propositionRepository.upsertMany(
          propositions.slice(index, index + options.batchSize),
        );
        summary.performance.writeMs += performance.now() - writeStarted;
        this.accountWrite(result, summary);
      }
    }
  }

  private accountProposition(
    proposition: ProposicaoInput,
    summary: HistoricalImportSummary,
  ): void {
    const year = summary.years.find(({ year }) => year === proposition.ano);
    if (!year) return;
    const deputyIds = new Set(
      proposition.autores.flatMap(({ parlamentarExternalId }) =>
        parlamentarExternalId === null ? [] : [parlamentarExternalId],
      ),
    );
    const hasThemes = proposition.temasOficiais.length > 0;
    const hasDeputy = deputyIds.size > 0;

    year.propositions += 1;
    year.associations += deputyIds.size;
    year.propositionsWithThemes += Number(hasThemes);
    year.propositionsWithoutThemes += Number(!hasThemes);
    year.propositionsWithDeputy += Number(hasDeputy);
    year.propositionsWithoutDeputy += Number(!hasDeputy);
    summary.associations += deputyIds.size;
    summary.propositionsWithThemes += Number(hasThemes);
    summary.propositionsWithoutThemes += Number(!hasThemes);
    summary.propositionsWithDeputy += Number(hasDeputy);
    summary.propositionsWithoutDeputy += Number(!hasDeputy);
  }

  private accountWrite(
    result: ProposicaoWriteResult,
    summary: HistoricalImportSummary,
  ): void {
    summary.inserted += result.inserted;
    summary.updated += result.updated;
    summary.unchanged += result.unchanged;
  }

  private recordError(summary: HistoricalImportSummary, message: string): void {
    summary.invalidRows += 1;
    if (summary.errors.length < MAX_REPORTED_ERRORS) {
      summary.errors.push(message);
    }
  }
}
