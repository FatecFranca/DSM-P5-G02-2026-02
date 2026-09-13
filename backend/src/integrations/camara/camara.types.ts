import type { z } from 'zod';

import type {
  camaraDetailResponseSchema,
  camaraDeputadoOrgaosResponseSchema,
  camaraListResponseSchema,
  camaraProposicaoAutoresResponseSchema,
  camaraProposicaoDetailResponseSchema,
  camaraProposicaoListResponseSchema,
  camaraProposicaoTemasResponseSchema,
  camaraVotacoesResponseSchema,
  camaraVotosResponseSchema,
} from './camara.schemas.js';

export type CamaraListResponse = z.infer<typeof camaraListResponseSchema>;
export type CamaraDetailResponse = z.infer<typeof camaraDetailResponseSchema>;
export type CamaraProposicaoListResponse = z.infer<
  typeof camaraProposicaoListResponseSchema
>;
export type CamaraProposicaoDetailResponse = z.infer<
  typeof camaraProposicaoDetailResponseSchema
>;
export type CamaraProposicaoAutoresResponse = z.infer<
  typeof camaraProposicaoAutoresResponseSchema
>;
export type CamaraProposicaoTemasResponse = z.infer<
  typeof camaraProposicaoTemasResponseSchema
>;
export type CamaraVotacoesResponse = z.infer<
  typeof camaraVotacoesResponseSchema
>;
export type CamaraVotosResponse = z.infer<typeof camaraVotosResponseSchema>;
export type CamaraDeputadoOrgaosResponse = z.infer<
  typeof camaraDeputadoOrgaosResponseSchema
>;

export interface CamaraPagination {
  pagina: number;
  itens: number;
}

export interface CamaraProposicaoQuery extends CamaraPagination {
  ano: number;
  deputadoIds: number[];
}

export interface CamaraIndicadorPeriodQuery extends CamaraPagination {
  dataInicio: string;
  dataFim: string;
}

export interface CamaraVotacaoQuery extends CamaraIndicadorPeriodQuery {
  orgaoId?: number;
}

export interface CamaraGateway {
  listDeputados(pagination: CamaraPagination): Promise<CamaraListResponse>;
  getDeputado(id: number): Promise<CamaraDetailResponse>;
  listProposicoes(
    query: CamaraProposicaoQuery,
  ): Promise<CamaraProposicaoListResponse>;
  getProposicao(id: number): Promise<CamaraProposicaoDetailResponse>;
  getProposicaoAutores(id: number): Promise<CamaraProposicaoAutoresResponse>;
  getProposicaoTemas(id: number): Promise<CamaraProposicaoTemasResponse>;
  listVotacoes(query: CamaraVotacaoQuery): Promise<CamaraVotacoesResponse>;
  getVotos(votacaoId: string): Promise<CamaraVotosResponse>;
  listDeputadoOrgaos(
    id: number,
    query: CamaraIndicadorPeriodQuery,
  ): Promise<CamaraDeputadoOrgaosResponse>;
}
