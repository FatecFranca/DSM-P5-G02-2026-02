import { SenadoUnavailableError } from '../../integrations/senado/senado.errors.js';
import type { SenadoGateway } from '../../integrations/senado/senado.types.js';
import { AppError } from '../../shared/errors/app-error.js';
import { mapSenadoSenatorToParlamentar } from '../parlamentares/senador.mapper.js';
import type { ParlamentarRepositoryContract } from '../parlamentares/parlamentar.types.js';
import type {
  SenadoSyncServiceContract,
  SenadoSyncSummary,
  SyncLogRepositoryContract,
} from './sync.types.js';

function safeErrorMessage(error: unknown): string {
  return error instanceof AppError
    ? error.message
    : 'Falha interna durante a sincronização.';
}

export class SenadoSyncService implements SenadoSyncServiceContract {
  constructor(
    private readonly senadoClient: SenadoGateway,
    private readonly parlamentarRepository: ParlamentarRepositoryContract,
    private readonly syncLogRepository: SyncLogRepositoryContract,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async syncSenators(): Promise<SenadoSyncSummary> {
    const startedAt = this.clock();
    const log = await this.syncLogRepository.start({
      source: 'SENADO',
      resource: 'SENADORES',
      startedAt,
    });
    const totals = {
      processed: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
    };

    try {
      const response = await this.senadoClient.listCurrentSenators();
      const senators = response.map((senator) =>
        mapSenadoSenatorToParlamentar(senator, startedAt),
      );
      totals.processed = senators.length;
      const result = await this.parlamentarRepository.upsertMany(senators);
      totals.inserted = result.inserted;
      totals.updated = result.updated;
      totals.unchanged = result.unchanged;
    } catch (error) {
      await this.syncLogRepository.finish(log.id, {
        finishedAt: this.clock(),
        status: 'FAILED',
        ...totals,
        errors: [safeErrorMessage(error)],
      });
      if (error instanceof Error) {
        throw error;
      }
      throw new SenadoUnavailableError();
    }

    await this.syncLogRepository.finish(log.id, {
      finishedAt: this.clock(),
      status: 'SUCCESS',
      ...totals,
      errors: [],
    });

    return {
      source: 'SENADO',
      resource: 'SENADORES',
      status: 'SUCCESS',
      ...totals,
      errors: [],
    };
  }
}
