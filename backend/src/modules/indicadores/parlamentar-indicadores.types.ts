import type { ParlamentarSource } from '../parlamentares/parlamentar.types.js';

export interface IndicadorListQuery {
  source: ParlamentarSource;
  parlamentarExternalId: number;
  inicio: Date;
  fimExclusivo: Date;
  page: number;
  limit: number;
}

export interface VotacaoParlamentarRecord {
  votacaoExternalId: string;
  data: Date;
  voto: string;
  descricao: string | null;
  resultado: string | null;
  casa: string;
  proposicaoExternalId: number | null;
}

export interface OrgaoParlamentarRecord {
  orgaoExternalId: number;
  sigla: string;
  nome: string;
  casa: string;
  funcao: string | null;
  inicio: Date | null;
  fim: Date | null;
}

export interface ParlamentarIndicadoresRepositoryContract {
  listVotacoes(
    query: IndicadorListQuery,
  ): Promise<{ data: VotacaoParlamentarRecord[]; total: number }>;
  listOrgaos(
    query: IndicadorListQuery,
  ): Promise<{ data: OrgaoParlamentarRecord[]; total: number }>;
}

interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface VotacaoParlamentarResponse extends Omit<
  VotacaoParlamentarRecord,
  'data'
> {
  data: string;
}

export interface OrgaoParlamentarResponse extends Omit<
  OrgaoParlamentarRecord,
  'inicio' | 'fim'
> {
  inicio: string | null;
  fim: string | null;
}

export interface ParlamentarIndicadoresServiceContract {
  listVotacoes(
    source: ParlamentarSource,
    id: number,
    query: {
      dataInicio: string;
      dataFim: string;
      page: number;
      limit: number;
    },
  ): Promise<{
    data: VotacaoParlamentarResponse[];
    pagination: PaginationResponse;
  }>;
  listOrgaos(
    source: ParlamentarSource,
    id: number,
    query: {
      dataInicio: string;
      dataFim: string;
      page: number;
      limit: number;
    },
  ): Promise<{
    data: OrgaoParlamentarResponse[];
    pagination: PaginationResponse;
  }>;
}
