import {
  DeputadoNotFoundError,
  ProposicaoNotFoundError,
} from '../../integrations/camara/camara.errors.js';
import type { ParlamentarRepositoryContract } from '../parlamentares/parlamentar.types.js';
import type {
  ProposicaoDetailResponse,
  ProposicaoListResponse,
  ProposicaoResponseItem,
  ProposicoesServiceContract,
} from './proposicoes.types.js';
import type {
  ProposicaoRecord,
  ProposicaoRepositoryContract,
  ProposicaoSource,
} from './proposicao.types.js';

function toResponseItem(record: ProposicaoRecord): ProposicaoResponseItem {
  return {
    ...record,
    dataApresentacao: record.dataApresentacao?.toISOString() ?? null,
    fetchedAt: record.fetchedAt.toISOString(),
  };
}

function toListResponse(
  result: { data: ProposicaoRecord[]; total: number },
  pagination: { page: number; limit: number },
): ProposicaoListResponse {
  return {
    data: result.data.map(toResponseItem),
    pagination: {
      ...pagination,
      total: result.total,
      totalPages: Math.ceil(result.total / pagination.limit),
    },
  };
}

export class ProposicaoService implements ProposicoesServiceContract {
  constructor(
    private readonly repository: ProposicaoRepositoryContract,
    private readonly parlamentarRepository: ParlamentarRepositoryContract,
  ) {}

  async list(query: {
    page: number;
    limit: number;
    ano?: number;
    tipo?: string;
    source?: ProposicaoSource;
  }): Promise<ProposicaoListResponse> {
    const result = await this.repository.list({
      ...query,
      source: query.source ?? 'CAMARA',
    });
    return toListResponse(result, { page: query.page, limit: query.limit });
  }

  async getById(
    id: number,
    source: ProposicaoSource = 'CAMARA',
  ): Promise<ProposicaoDetailResponse> {
    const record = await this.repository.findByExternalId({
      source,
      externalId: id,
    });
    if (!record) {
      throw new ProposicaoNotFoundError();
    }
    return { data: toResponseItem(record) };
  }

  async listByParlamentar(
    id: number,
    pagination: { page: number; limit: number },
  ): Promise<ProposicaoListResponse> {
    const parlamentar = await this.parlamentarRepository.findByExternalId({
      source: 'CAMARA',
      externalId: id,
    });
    if (!parlamentar) {
      throw new DeputadoNotFoundError();
    }

    const result = await this.repository.list({
      source: 'CAMARA',
      ...pagination,
      parlamentarExternalId: id,
    });
    return toListResponse(result, pagination);
  }
}
