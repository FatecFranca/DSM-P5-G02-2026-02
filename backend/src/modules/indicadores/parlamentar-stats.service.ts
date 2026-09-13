import { DeputadoNotFoundError } from '../../integrations/camara/camara.errors.js';
import { SenadorNotFoundError } from '../../integrations/senado/senado.errors.js';
import type {
  ParlamentarRepositoryContract,
  ParlamentarSource,
} from '../parlamentares/parlamentar.types.js';
import { EstatisticaInvalidPeriodError } from './indicador.errors.js';
import type {
  ParlamentarStatsRepositoryContract,
  ParlamentarStatsResponse,
  ParlamentarStatsServiceContract,
} from './parlamentar-stats.types.js';

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === value ? date : null;
}

export class ParlamentarStatsService implements ParlamentarStatsServiceContract {
  constructor(
    private readonly statsRepository: ParlamentarStatsRepositoryContract,
    private readonly parlamentarRepository: ParlamentarRepositoryContract,
  ) {}

  async getStats(
    source: ParlamentarSource,
    id: number,
    periodo: { dataInicio: string; dataFim: string },
  ): Promise<ParlamentarStatsResponse> {
    const inicio = parseDate(periodo.dataInicio);
    const fim = parseDate(periodo.dataFim);
    if (!inicio || !fim || inicio > fim) {
      throw new EstatisticaInvalidPeriodError();
    }
    const fimExclusivo = new Date(fim);
    fimExclusivo.setUTCDate(fimExclusivo.getUTCDate() + 1);

    const parlamentar = await this.parlamentarRepository.findByExternalId({
      source,
      externalId: id,
    });
    if (!parlamentar) {
      throw source === 'CAMARA'
        ? new DeputadoNotFoundError()
        : new SenadorNotFoundError();
    }

    const stats = await this.statsRepository.getStats({
      source,
      parlamentarExternalId: id,
      inicio,
      fimExclusivo,
    });
    return {
      parlamentar: { externalId: id, source },
      periodo: { inicio: periodo.dataInicio, fim: periodo.dataFim },
      estatisticas: {
        proposicoes: stats.proposicoes,
        votacoes: stats.votacoes,
        comissoesOrgaos: stats.comissoesOrgaos,
        temasDistintos: stats.temas.length,
      },
      temas: stats.temas,
    };
  }
}
