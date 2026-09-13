import {
  SenadorNotFoundError,
  SenadoUnavailableError,
} from '../../integrations/senado/senado.errors.js';
import type {
  SenadoMateriaDetail,
  SenadoMateriaGateway,
} from '../../integrations/senado/senado.types.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { ParlamentarRepositoryContract } from '../parlamentares/parlamentar.types.js';
import { mapSenadoMateriaToProposicao } from '../proposicoes/senado-materia.mapper.js';
import type { ProposicaoRepositoryContract } from '../proposicoes/proposicao.types.js';
import type {
  SenadoMateriaSyncInput,
  SenadoMateriaSyncServiceContract,
  SenadoMateriaSyncSummary,
  SyncLogRepositoryContract,
} from './sync.types.js';

function safeErrorMessage(error: unknown): string {
  return error instanceof AppError
    ? error.message
    : 'Falha interna durante a sincronização.';
}

export class SenadoMateriaSyncService implements SenadoMateriaSyncServiceContract {
  constructor(
    private readonly senadoClient: SenadoMateriaGateway,
    private readonly proposicaoRepository: ProposicaoRepositoryContract,
    private readonly parlamentarRepository: ParlamentarRepositoryContract,
    private readonly syncLogRepository: SyncLogRepositoryContract,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async syncMaterias(
    input: SenadoMateriaSyncInput,
  ): Promise<SenadoMateriaSyncSummary> {
    const startedAt = this.clock();
    const log = await this.syncLogRepository.start({
      source: 'SENADO',
      resource: 'MATERIAS',
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
      const knownSenatorIds = await this.getKnownSenatorIds(
        input.senadorIds,
        true,
      );
      const summariesById = new Map<number, { id: number }>();
      for (const senatorId of input.senadorIds) {
        const summaries = await this.senadoClient.listMaterias({
          ano: input.ano,
          senadorId: senatorId,
          siglas: input.siglas,
        });
        for (const summary of summaries) {
          summariesById.set(summary.id, summary);
        }
      }

      const summaries = [...summariesById.values()].slice(0, input.maxMaterias);
      totals.processed = summaries.length;
      const propositions = [];

      for (const summary of summaries) {
        try {
          const detail = await this.senadoClient.getMateriaById(summary.id);
          const candidateIds = this.authorSenatorIds(detail.data).filter(
            (id) => !knownSenatorIds.has(id),
          );
          const linkedIds = await this.getKnownSenatorIds(candidateIds, false);
          for (const id of linkedIds) knownSenatorIds.add(id);
          propositions.push(
            mapSenadoMateriaToProposicao(detail, knownSenatorIds, startedAt),
          );
        } catch (error) {
          errors.push(`Matéria ${summary.id}: ${safeErrorMessage(error)}`);
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
      throw new SenadoUnavailableError();
    }

    const status = errors.length > 0 ? 'PARTIAL' : 'SUCCESS';
    await this.syncLogRepository.finish(log.id, {
      finishedAt: this.clock(),
      status,
      ...totals,
      errors,
    });

    return {
      source: 'SENADO',
      resource: 'MATERIAS',
      status,
      ...totals,
      errors,
    };
  }

  private authorSenatorIds(detail: SenadoMateriaDetail): number[] {
    return [...detail.documento.autoria, ...detail.autoriaIniciativa]
      .filter(
        (author) =>
          author.siglaTipo === 'SENADOR' &&
          author.codigoParlamentar !== undefined,
      )
      .map((author) => author.codigoParlamentar as number);
  }

  private async getKnownSenatorIds(
    ids: number[],
    requireAll: boolean,
  ): Promise<Set<number>> {
    const known = new Set<number>();
    for (const id of new Set(ids)) {
      const senator = await this.parlamentarRepository.findByExternalId({
        source: 'SENADO',
        externalId: id,
      });
      if (senator) {
        known.add(id);
      } else if (requireAll) {
        throw new SenadorNotFoundError();
      }
    }
    return known;
  }
}
