import {
  CamaraUnavailableError,
  DeputadoNotFoundError,
} from '../../integrations/camara/camara.errors.js';
import type { CamaraGateway } from '../../integrations/camara/camara.types.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { ParlamentarRepositoryContract } from '../parlamentares/parlamentar.types.js';
import { mapCamaraProposicaoToProposicao } from '../proposicoes/proposicao.mapper.js';
import type { ProposicaoRepositoryContract } from '../proposicoes/proposicao.types.js';
import type {
  ProposicaoSyncInput,
  ProposicaoSyncServiceContract,
  ProposicaoSyncSummary,
  SyncLogRepositoryContract,
} from './sync.types.js';

function safeErrorMessage(error: unknown): string {
  return error instanceof AppError
    ? error.message
    : 'Falha interna durante a sincronização.';
}

function authorDeputadoId(uri: string | null | undefined): number | null {
  const match = uri?.match(/\/deputados\/(\d+)\/?$/);
  const id = match ? Number(match[1]) : Number.NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export class ProposicaoSyncService implements ProposicaoSyncServiceContract {
  constructor(
    private readonly camaraClient: CamaraGateway,
    private readonly proposicaoRepository: ProposicaoRepositoryContract,
    private readonly parlamentarRepository: ParlamentarRepositoryContract,
    private readonly syncLogRepository: SyncLogRepositoryContract,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async syncProposicoes(
    input: ProposicaoSyncInput,
  ): Promise<ProposicaoSyncSummary> {
    const startedAt = this.clock();
    const log = await this.syncLogRepository.start({
      source: 'CAMARA',
      resource: 'PROPOSICOES',
      startedAt,
    });
    const totals = {
      processed: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
    };
    const errors: string[] = [];

    try {
      const knownParlamentarIds = await this.getKnownParlamentarIds(
        input.deputadoIds,
        true,
      );
      const response = await this.camaraClient.listProposicoes({
        ano: input.ano,
        deputadoIds: input.deputadoIds,
        pagina: 1,
        itens: input.maxProposicoes,
      });
      const summaries = response.dados.slice(0, input.maxProposicoes);
      totals.processed = summaries.length;
      const propositions = [];

      for (const summary of summaries) {
        try {
          const detail = await this.camaraClient.getProposicao(summary.id);
          const authors = await this.camaraClient.getProposicaoAutores(
            summary.id,
          );
          const themes = await this.camaraClient.getProposicaoTemas(summary.id);
          const candidateIds = authors.dados
            .map((author) => authorDeputadoId(author.uri))
            .filter((id): id is number => id !== null);
          const linkedIds = await this.getKnownParlamentarIds(
            candidateIds.filter((id) => !knownParlamentarIds.has(id)),
            false,
          );
          for (const id of linkedIds) knownParlamentarIds.add(id);

          propositions.push(
            mapCamaraProposicaoToProposicao(
              detail.dados,
              authors.dados,
              themes.dados,
              knownParlamentarIds,
              startedAt,
            ),
          );
        } catch (error) {
          errors.push(`Proposição ${summary.id}: ${safeErrorMessage(error)}`);
        }
      }

      const result = await this.proposicaoRepository.upsertMany(propositions);
      totals.inserted = result.inserted;
      totals.updated = result.updated;
      totals.unchanged = result.unchanged;
    } catch (error) {
      await this.syncLogRepository.finish(log.id, {
        finishedAt: this.clock(),
        status: totals.processed > 0 ? 'PARTIAL' : 'FAILED',
        ...totals,
        errors: [safeErrorMessage(error)],
      });
      if (error instanceof Error) throw error;
      throw new CamaraUnavailableError();
    }

    const status = errors.length > 0 ? 'PARTIAL' : 'SUCCESS';
    await this.syncLogRepository.finish(log.id, {
      finishedAt: this.clock(),
      status,
      ...totals,
      errors,
    });

    return {
      source: 'CAMARA',
      resource: 'PROPOSICOES',
      status,
      ...totals,
      errors,
    };
  }

  private async getKnownParlamentarIds(
    ids: number[],
    requireAll: boolean,
  ): Promise<Set<number>> {
    const known = new Set<number>();
    for (const id of new Set(ids)) {
      const parlamentar = await this.parlamentarRepository.findByExternalId({
        source: 'CAMARA',
        externalId: id,
      });
      if (parlamentar) {
        known.add(id);
      } else if (requireAll) {
        throw new DeputadoNotFoundError();
      }
    }
    return known;
  }
}
