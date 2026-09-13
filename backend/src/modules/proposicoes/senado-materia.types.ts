import type { ProposicaoListResponse } from './proposicoes.types.js';

export interface SenadoMateriasServiceContract {
  listBySenator(
    id: number,
    pagination: { page: number; limit: number },
  ): Promise<ProposicaoListResponse>;
}
