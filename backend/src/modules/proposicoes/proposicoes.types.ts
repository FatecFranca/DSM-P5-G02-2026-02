import type {
  ProposicaoAutor,
  ProposicaoSource,
  ProposicaoTemaOficial,
} from './proposicao.types.js';

export interface ProposicaoResponseItem {
  externalId: number;
  source: ProposicaoSource;
  tipo: string;
  numero: number;
  ano: number;
  ementa: string | null;
  descricao: string | null;
  dataApresentacao: string | null;
  situacao: string | null;
  uri: string;
  urlFonte: string | null;
  autores: ProposicaoAutor[];
  temasOficiais: ProposicaoTemaOficial[];
  fetchedAt: string;
}

export interface ProposicaoListResponse {
  data: ProposicaoResponseItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProposicaoDetailResponse {
  data: ProposicaoResponseItem;
}

export interface ProposicoesServiceContract {
  list(query: {
    page: number;
    limit: number;
    ano?: number;
    tipo?: string;
    source?: ProposicaoSource;
  }): Promise<ProposicaoListResponse>;
  getById(
    id: number,
    source?: ProposicaoSource,
  ): Promise<ProposicaoDetailResponse>;
  listByParlamentar(
    id: number,
    pagination: { page: number; limit: number },
  ): Promise<ProposicaoListResponse>;
}
