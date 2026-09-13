import { DeputadoNotFoundError } from '../../integrations/camara/camara.errors.js';
import type {
  DeputadoDetailResponse,
  DeputadoListResponse,
  DeputadosServiceContract,
} from './deputados.types.js';
import type {
  ParlamentarRecord,
  ParlamentarRepositoryContract,
} from './parlamentar.types.js';

function toListItem(parlamentar: ParlamentarRecord) {
  return {
    externalId: parlamentar.externalId,
    nome: parlamentar.nome,
    partido: parlamentar.partido,
    uf: parlamentar.uf,
    fotoUrl: parlamentar.fotoUrl,
    email: parlamentar.email,
  };
}

export class ParlamentarService implements DeputadosServiceContract {
  constructor(private readonly repository: ParlamentarRepositoryContract) {}

  async list(pagination: {
    page: number;
    limit: number;
  }): Promise<DeputadoListResponse> {
    const result = await this.repository.list({
      source: 'CAMARA',
      ...pagination,
    });

    return {
      data: result.data.map(toListItem),
      pagination: {
        ...pagination,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit),
      },
    };
  }

  async getById(id: number): Promise<DeputadoDetailResponse> {
    const parlamentar = await this.repository.findByExternalId({
      source: 'CAMARA',
      externalId: id,
    });

    if (!parlamentar) {
      throw new DeputadoNotFoundError();
    }

    return {
      data: {
        externalId: parlamentar.externalId,
        source: 'CAMARA',
        nome: parlamentar.nome,
        nomeCivil: parlamentar.nomeCivil,
        partido: parlamentar.partido,
        uf: parlamentar.uf,
        casa: 'CAMARA',
        fotoUrl: parlamentar.fotoUrl,
        email: parlamentar.email,
        situacao: parlamentar.situacao,
      },
    };
  }
}
