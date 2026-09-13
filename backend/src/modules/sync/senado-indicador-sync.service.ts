import {
  SenadorNotFoundError,
  SenadoUnavailableError,
} from '../../integrations/senado/senado.errors.js';
import type { SenadoIndicadoresGateway } from '../../integrations/senado/senado.types.js';
import { AppError } from '../../shared/errors/app-error.js';
import { IndicadorInvalidPeriodError } from '../indicadores/indicador.errors.js';
import type {
  IndicadorWriteResult,
  ParticipacaoOrgaoRepositoryContract,
  VotacaoRepositoryContract,
  VotoRepositoryContract,
} from '../indicadores/indicador.types.js';
import {
  mapSenadoParticipacaoOrgao,
  mapSenadoVotacao,
  mapSenadoVoto,
} from '../indicadores/senado-indicador.mapper.js';
import type { ParlamentarRepositoryContract } from '../parlamentares/parlamentar.types.js';
import type {
  IndicadorSyncInput,
  IndicadorSyncSummary,
  SenadoIndicadorSyncServiceContract,
  SyncLogRepositoryContract,
} from './sync.types.js';

function safeMessage(error: unknown): string {
  return error instanceof AppError
    ? error.message
    : 'Falha interna durante a sincronização.';
}

function validatePeriod(inicio: string, fim: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
    throw new IndicadorInvalidPeriodError();
  }
  const start = new Date(`${inicio}T00:00:00.000Z`);
  const end = new Date(`${fim}T00:00:00.000Z`);
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.toISOString().slice(0, 10) !== inicio ||
    end.toISOString().slice(0, 10) !== fim ||
    Number.isNaN(days) ||
    days < 0 ||
    days > 30
  ) {
    throw new IndicadorInvalidPeriodError();
  }
}

function addResult(
  totals: IndicadorWriteResult & { processed: number },
  writeResult: IndicadorWriteResult,
): void {
  totals.inserted += writeResult.inserted;
  totals.updated += writeResult.updated;
  totals.unchanged += writeResult.unchanged;
}

export class SenadoIndicadorSyncService implements SenadoIndicadorSyncServiceContract {
  constructor(
    private readonly client: SenadoIndicadoresGateway,
    private readonly votacaoRepository: VotacaoRepositoryContract,
    private readonly votoRepository: VotoRepositoryContract,
    private readonly participacaoRepository: ParticipacaoOrgaoRepositoryContract,
    private readonly parlamentarRepository: ParlamentarRepositoryContract,
    private readonly syncLogRepository: SyncLogRepositoryContract,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async syncIndicadores(
    input: IndicadorSyncInput,
  ): Promise<IndicadorSyncSummary> {
    const startedAt = this.clock();
    const log = await this.syncLogRepository.start({
      source: 'SENADO',
      resource: 'INDICADORES',
      startedAt,
    });
    const totals = { processed: 0, inserted: 0, updated: 0, unchanged: 0 };
    const errors: string[] = [];
    const fatalErrors: unknown[] = [];
    let successfulExternalSections = 0;

    try {
      validatePeriod(input.dataInicio, input.dataFim);
      const parlamentar = await this.parlamentarRepository.findByExternalId({
        source: 'SENADO',
        externalId: input.parlamentarExternalId,
      });
      if (!parlamentar) throw new SenadorNotFoundError();

      try {
        const response = await this.client.listVotacoes({
          senadorId: input.parlamentarExternalId,
          dataInicio: input.dataInicio,
          dataFim: input.dataFim,
        });
        successfulExternalSections += 1;
        const votacoes = [];
        const votos = [];
        const orderedResponse = [...response].sort(
          (left, right) => left.codigoSessaoVotacao - right.codigoSessaoVotacao,
        );
        for (const external of orderedResponse) {
          const targetVote = external.votos.find(
            ({ codigoParlamentar }) =>
              codigoParlamentar === input.parlamentarExternalId,
          );
          if (!targetVote) continue;
          votacoes.push(mapSenadoVotacao(external, startedAt));
          votos.push(mapSenadoVoto(external, targetVote, startedAt));
          if (votacoes.length === input.maxVotacoes) break;
        }
        totals.processed += votacoes.length + votos.length;
        let votacoesPersisted = false;
        try {
          addResult(totals, await this.votacaoRepository.upsertMany(votacoes));
          votacoesPersisted = true;
        } catch (error) {
          errors.push(`Votações: ${safeMessage(error)}`);
        }
        if (votacoesPersisted) {
          try {
            addResult(totals, await this.votoRepository.upsertMany(votos));
          } catch (error) {
            errors.push(`Votos: ${safeMessage(error)}`);
          }
        }
      } catch (error) {
        fatalErrors.push(error);
        errors.push(`Votações: ${safeMessage(error)}`);
      }

      try {
        const response = await this.client.listSenadorComissoes(
          input.parlamentarExternalId,
        );
        successfulExternalSections += 1;
        const participacoes = response
          .map((item) =>
            mapSenadoParticipacaoOrgao(
              input.parlamentarExternalId,
              item,
              startedAt,
            ),
          )
          .sort(
            (left, right) =>
              left.orgaoExternalId - right.orgaoExternalId ||
              (left.funcao ?? '').localeCompare(right.funcao ?? '') ||
              (left.inicio?.getTime() ?? 0) - (right.inicio?.getTime() ?? 0),
          )
          .slice(0, input.maxOrgaos);
        totals.processed += participacoes.length;
        try {
          addResult(
            totals,
            await this.participacaoRepository.upsertMany(participacoes),
          );
        } catch (error) {
          errors.push(`Comissões: ${safeMessage(error)}`);
        }
      } catch (error) {
        fatalErrors.push(error);
        errors.push(`Comissões: ${safeMessage(error)}`);
      }

      if (successfulExternalSections === 0) {
        const error = fatalErrors[0];
        await this.finish(log.id, 'FAILED', totals, errors);
        if (error instanceof Error) throw error;
        throw new SenadoUnavailableError();
      }
    } catch (error) {
      if (successfulExternalSections === 0 && fatalErrors.length === 0) {
        await this.finish(log.id, 'FAILED', totals, [safeMessage(error)]);
      }
      throw error;
    }

    const status = errors.length > 0 ? 'PARTIAL' : 'SUCCESS';
    await this.finish(log.id, status, totals, errors);
    return {
      source: 'SENADO',
      resource: 'INDICADORES',
      status,
      ...totals,
      errors,
    };
  }

  private finish(
    id: string,
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED',
    totals: IndicadorWriteResult & { processed: number },
    errors: string[],
  ): Promise<void> {
    return this.syncLogRepository.finish(id, {
      finishedAt: this.clock(),
      status,
      ...totals,
      errors,
    });
  }
}
