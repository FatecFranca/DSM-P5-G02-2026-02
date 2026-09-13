import { SenadorNotFoundError } from '../../integrations/senado/senado.errors.js';
import type { ParlamentarRepositoryContract } from '../parlamentares/parlamentar.types.js';
import type { ProposicaoListResponse } from './proposicoes.types.js';
import type { ProposicaoRepositoryContract } from './proposicao.types.js';
import type { SenadoMateriasServiceContract } from './senado-materia.types.js';

export class SenadoMateriaService implements SenadoMateriasServiceContract {
  constructor(
    private readonly repository: ProposicaoRepositoryContract,
    private readonly parlamentarRepository: ParlamentarRepositoryContract,
  ) {}

  async listBySenator(
    id: number,
    pagination: { page: number; limit: number },
  ): Promise<ProposicaoListResponse> {
    const senator = await this.parlamentarRepository.findByExternalId({
      source: 'SENADO',
      externalId: id,
    });
    if (!senator) {
      throw new SenadorNotFoundError();
    }

    const result = await this.repository.list({
      source: 'SENADO',
      ...pagination,
      parlamentarExternalId: id,
    });

    return {
      data: result.data.map((record) => ({
        ...record,
        dataApresentacao: record.dataApresentacao?.toISOString() ?? null,
        fetchedAt: record.fetchedAt.toISOString(),
      })),
      pagination: {
        ...pagination,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit),
      },
    };
  }
}
