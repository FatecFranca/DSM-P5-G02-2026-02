export interface DeputadoListItem {
  externalId: number;
  nome: string;
  partido: string | null;
  uf: string | null;
  fotoUrl: string | null;
  email: string | null;
}

export interface DeputadoListResponse {
  data: DeputadoListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DeputadoDetailResponse {
  data: {
    externalId: number;
    source: 'CAMARA';
    nome: string;
    nomeCivil: string | null;
    partido: string | null;
    uf: string | null;
    casa: 'CAMARA';
    fotoUrl: string | null;
    email: string | null;
    situacao: string | null;
  };
}

export interface DeputadosServiceContract {
  list(pagination: {
    page: number;
    limit: number;
  }): Promise<DeputadoListResponse>;
  getById(id: number): Promise<DeputadoDetailResponse>;
}
