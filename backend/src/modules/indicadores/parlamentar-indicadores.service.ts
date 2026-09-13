import { DeputadoNotFoundError } from '../../integrations/camara/camara.errors.js';
import { SenadorNotFoundError } from '../../integrations/senado/senado.errors.js';
import type {
  ParlamentarRepositoryContract,
  ParlamentarSource,
} from '../parlamentares/parlamentar.types.js';
import { EstatisticaInvalidPeriodError } from './indicador.errors.js';
import type {
  IndicadorListQuery,
  ParlamentarIndicadoresRepositoryContract,
  ParlamentarIndicadoresServiceContract,
} from './parlamentar-indicadores.types.js';

function parsePeriod(dataInicio: string, dataFim: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)
  ) {
    throw new EstatisticaInvalidPeriodError();
  }
  const inicio = new Date(`${dataInicio}T00:00:00.000Z`);
  const fim = new Date(`${dataFim}T00:00:00.000Z`);
  if (
    Number.isNaN(inicio.getTime()) ||
    Number.isNaN(fim.getTime()) ||
    inicio.toISOString().slice(0, 10) !== dataInicio ||
    fim.toISOString().slice(0, 10) !== dataFim ||
    inicio > fim
  ) {
    throw new EstatisticaInvalidPeriodError();
  }
  const fimExclusivo = new Date(fim);
  fimExclusivo.setUTCDate(fimExclusivo.getUTCDate() + 1);
  return { inicio, fimExclusivo };
}

export class ParlamentarIndicadoresService implements ParlamentarIndicadoresServiceContract {
  constructor(
    private readonly repository: ParlamentarIndicadoresRepositoryContract,
    private readonly parlamentarRepository: ParlamentarRepositoryContract,
  ) {}

  async listVotacoes(
    source: ParlamentarSource,
    id: number,
    query: {
      dataInicio: string;
      dataFim: string;
      page: number;
      limit: number;
    },
  ) {
    const repositoryQuery = await this.validate(source, id, query);
    const result = await this.repository.listVotacoes(repositoryQuery);
    return {
      data: result.data.map((item) => ({
        ...item,
        data: item.data.toISOString(),
      })),
      pagination: this.pagination(query, result.total),
    };
  }

  async listOrgaos(
    source: ParlamentarSource,
    id: number,
    query: {
      dataInicio: string;
      dataFim: string;
      page: number;
      limit: number;
    },
  ) {
    const repositoryQuery = await this.validate(source, id, query);
    const result = await this.repository.listOrgaos(repositoryQuery);
    return {
      data: result.data.map((item) => ({
        ...item,
        inicio: item.inicio?.toISOString() ?? null,
        fim: item.fim?.toISOString() ?? null,
      })),
      pagination: this.pagination(query, result.total),
    };
  }

  private async validate(
    source: ParlamentarSource,
    id: number,
    query: {
      dataInicio: string;
      dataFim: string;
      page: number;
      limit: number;
    },
  ): Promise<IndicadorListQuery> {
    const period = parsePeriod(query.dataInicio, query.dataFim);
    const parlamentar = await this.parlamentarRepository.findByExternalId({
      source,
      externalId: id,
    });
    if (!parlamentar) {
      throw source === 'CAMARA'
        ? new DeputadoNotFoundError()
        : new SenadorNotFoundError();
    }
    return {
      source,
      parlamentarExternalId: id,
      ...period,
      page: query.page,
      limit: query.limit,
    };
  }

  private pagination(query: { page: number; limit: number }, total: number) {
    return {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }
}
