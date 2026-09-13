import {
  CamaraUnavailableError,
  DeputadoNotFoundError,
} from '../../integrations/camara/camara.errors.js';
import type { CamaraGateway } from '../../integrations/camara/camara.types.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  mapCamaraParticipacaoOrgao,
  mapCamaraVotacao,
  mapCamaraVoto,
} from '../indicadores/camara-indicador.mapper.js';
import { IndicadorInvalidPeriodError } from '../indicadores/indicador.errors.js';
import type {
  IndicadorWriteResult,
  ParticipacaoOrgaoRepositoryContract,
  VotacaoInput,
  VotacaoRepositoryContract,
  VotoInput,
  VotoRepositoryContract,
} from '../indicadores/indicador.types.js';
import type { ParlamentarRepositoryContract } from '../parlamentares/parlamentar.types.js';
import type {
  CamaraIndicadorSyncInput,
  CamaraIndicadorSyncServiceContract,
  IndicadorSyncSummary,
  SyncLogRepositoryContract,
} from './sync.types.js';

type CamaraIndicadoresGateway = Pick<
  CamaraGateway,
  'listVotacoes' | 'getVotos' | 'listDeputadoOrgaos'
>;

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

function nextDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function addResult(
  totals: IndicadorWriteResult & { processed: number },
  writeResult: IndicadorWriteResult,
): void {
  totals.inserted += writeResult.inserted;
  totals.updated += writeResult.updated;
  totals.unchanged += writeResult.unchanged;
}

export class CamaraIndicadorSyncService implements CamaraIndicadorSyncServiceContract {
  constructor(
    private readonly client: CamaraIndicadoresGateway,
    private readonly votacaoRepository: VotacaoRepositoryContract,
    private readonly votoRepository: VotoRepositoryContract,
    private readonly participacaoRepository: ParticipacaoOrgaoRepositoryContract,
    private readonly parlamentarRepository: ParlamentarRepositoryContract,
    private readonly syncLogRepository: SyncLogRepositoryContract,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async syncIndicadores(
    input: CamaraIndicadorSyncInput,
  ): Promise<IndicadorSyncSummary> {
    const startedAt = this.clock();
    const log = await this.syncLogRepository.start({
      source: 'CAMARA',
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
        source: 'CAMARA',
        externalId: input.parlamentarExternalId,
      });
      if (!parlamentar) throw new DeputadoNotFoundError();

      try {
        const response = await this.client.listVotacoes({
          dataInicio: input.dataInicio,
          dataFim: nextDate(input.dataFim),
          ...(input.orgaoId === undefined ? {} : { orgaoId: input.orgaoId }),
          pagina: 1,
          itens: input.maxVotacoes,
        });
        successfulExternalSections += 1;
        const votacoes: VotacaoInput[] = [];
        const votos: VotoInput[] = [];
        for (const external of response.dados.slice(0, input.maxVotacoes)) {
          try {
            const votes = await this.client.getVotos(external.id);
            const targetVote = votes.dados.find(
              ({ deputado_ }) => deputado_.id === input.parlamentarExternalId,
            );
            if (!targetVote) continue;
            const voting = mapCamaraVotacao(external, startedAt);
            votacoes.push(voting);
            votos.push(
              mapCamaraVoto(external.id, voting.data, targetVote, startedAt),
            );
          } catch (error) {
            errors.push(`Votação ${external.id}: ${safeMessage(error)}`);
          }
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
        const response = await this.client.listDeputadoOrgaos(
          input.parlamentarExternalId,
          {
            dataInicio: input.dataInicio,
            dataFim: input.dataFim,
            pagina: 1,
            itens: input.maxOrgaos,
          },
        );
        successfulExternalSections += 1;
        const participacoes = response.dados
          .slice(0, input.maxOrgaos)
          .map((item) =>
            mapCamaraParticipacaoOrgao(
              input.parlamentarExternalId,
              item,
              startedAt,
            ),
          );
        totals.processed += participacoes.length;
        try {
          addResult(
            totals,
            await this.participacaoRepository.upsertMany(participacoes),
          );
        } catch (error) {
          errors.push(`Órgãos: ${safeMessage(error)}`);
        }
      } catch (error) {
        fatalErrors.push(error);
        errors.push(`Órgãos: ${safeMessage(error)}`);
      }

      if (successfulExternalSections === 0) {
        const error = fatalErrors[0];
        await this.finish(log.id, 'FAILED', totals, errors);
        if (error instanceof Error) throw error;
        throw new CamaraUnavailableError();
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
      source: 'CAMARA',
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
