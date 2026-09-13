export interface SenadorListItem {
  externalId: number;
  nome: string;
  partido: string | null;
  uf: string | null;
  fotoUrl: string | null;
  email: string | null;
}

export interface SenadorListResponse {
  data: SenadorListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SenadorDetailResponse {
  data: {
    externalId: number;
    source: 'SENADO';
    nome: string;
    nomeCivil: string | null;
    partido: string | null;
    uf: string | null;
    casa: 'SENADO';
    fotoUrl: string | null;
    email: string | null;
    situacao: string | null;
  };
}

export interface SenadoresServiceContract {
  list(pagination: {
    page: number;
    limit: number;
  }): Promise<SenadorListResponse>;
  getById(id: number): Promise<SenadorDetailResponse>;
}
