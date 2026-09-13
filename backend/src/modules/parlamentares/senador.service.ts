import { SenadorNotFoundError } from '../../integrations/senado/senado.errors.js';
import type { ParlamentarRepositoryContract } from './parlamentar.types.js';
import type {
  SenadorDetailResponse,
  SenadorListResponse,
  SenadoresServiceContract,
} from './senadores.types.js';

export class SenadorService implements SenadoresServiceContract {
  constructor(private readonly repository: ParlamentarRepositoryContract) {}

  async list(pagination: {
    page: number;
    limit: number;
  }): Promise<SenadorListResponse> {
    const result = await this.repository.list({
      source: 'SENADO',
      ...pagination,
    });

    return {
      data: result.data.map((senator) => ({
        externalId: senator.externalId,
        nome: senator.nome,
        partido: senator.partido,
        uf: senator.uf,
        fotoUrl: senator.fotoUrl,
        email: senator.email,
      })),
      pagination: {
        ...pagination,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit),
      },
    };
  }

  async getById(id: number): Promise<SenadorDetailResponse> {
    const senator = await this.repository.findByExternalId({
      source: 'SENADO',
      externalId: id,
    });
    if (!senator) {
      throw new SenadorNotFoundError();
    }

    return {
      data: {
        externalId: senator.externalId,
        source: 'SENADO',
        nome: senator.nome,
        nomeCivil: senator.nomeCivil,
        partido: senator.partido,
        uf: senator.uf,
        casa: 'SENADO',
        fotoUrl: senator.fotoUrl,
        email: senator.email,
        situacao: senator.situacao,
      },
    };
  }
}
