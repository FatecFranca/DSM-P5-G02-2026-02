import {
  CamaraInvalidResponseError,
  CamaraUnavailableError,
} from '../../integrations/camara/camara.errors.js';
import type {
  CamaraGateway,
  CamaraListResponse,
} from '../../integrations/camara/camara.types.js';
import { AppError } from '../../shared/errors/app-error.js';
import { mapCamaraDeputadoToParlamentar } from '../parlamentares/parlamentar.mapper.js';
import type { ParlamentarRepositoryContract } from '../parlamentares/parlamentar.types.js';
import type {
  CamaraSyncServiceContract,
  SyncLogRepositoryContract,
  SyncSummary,
} from './sync.types.js';

const PAGE_SIZE = 100;

function getNextPage(response: CamaraListResponse): number | null {
  const nextLink = response.links?.find((link) => link.rel === 'next');
  if (!nextLink) {
    return null;
  }

  const page = Number(new URL(nextLink.href).searchParams.get('pagina'));
  if (!Number.isInteger(page) || page < 1) {
    throw new CamaraInvalidResponseError();
  }

  return page;
}

function safeErrorMessage(error: unknown): string {
  return error instanceof AppError
    ? error.message
    : 'Falha interna durante a sincronização.';
}

export class CamaraSyncService implements CamaraSyncServiceContract {
  constructor(
    private readonly camaraClient: CamaraGateway,
    private readonly parlamentarRepository: ParlamentarRepositoryContract,
    private readonly syncLogRepository: SyncLogRepositoryContract,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async syncDeputados(): Promise<SyncSummary> {
    const startedAt = this.clock();
    const log = await this.syncLogRepository.start({
      source: 'CAMARA',
      resource: 'DEPUTADOS',
      startedAt,
    });
    const totals = {
      processed: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
    };
    const visitedPages = new Set<number>();

    let page: number | null = 1;

    try {
      while (page !== null) {
        if (visitedPages.has(page)) {
          throw new CamaraInvalidResponseError();
        }
        visitedPages.add(page);

        const response = await this.camaraClient.listDeputados({
          pagina: page,
          itens: PAGE_SIZE,
        });
        const parlamentares = response.dados.map((deputado) =>
          mapCamaraDeputadoToParlamentar(deputado, startedAt),
        );
        totals.processed += parlamentares.length;
        const writeResult =
          await this.parlamentarRepository.upsertMany(parlamentares);

        totals.inserted += writeResult.inserted;
        totals.updated += writeResult.updated;
        totals.unchanged += writeResult.unchanged;
        page = getNextPage(response);
      }
    } catch (error) {
      await this.syncLogRepository.finish(log.id, {
        finishedAt: this.clock(),
        status: totals.processed > 0 ? 'PARTIAL' : 'FAILED',
        ...totals,
        errors: [safeErrorMessage(error)],
      });

      if (error instanceof Error) {
        throw error;
      }

      throw new CamaraUnavailableError();
    }

    await this.syncLogRepository.finish(log.id, {
      finishedAt: this.clock(),
      status: 'SUCCESS',
      ...totals,
      errors: [],
    });

    return {
      source: 'CAMARA',
      resource: 'DEPUTADOS',
      status: 'SUCCESS',
      ...totals,
    };
  }
}
