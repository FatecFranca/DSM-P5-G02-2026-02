export type ParlamentarSource = 'CAMARA' | 'SENADO';
export type CasaLegislativa = 'CAMARA' | 'SENADO';

export interface ParlamentarInput {
  externalId: number;
  source: ParlamentarSource;
  casa: CasaLegislativa;
  nome: string;
  nomeCivil?: string | null;
  partido: string | null;
  uf: string | null;
  fotoUrl: string | null;
  email: string | null;
  situacao?: string | null;
  legislatura: number | null;
  fetchedAt: Date;
}

export interface ParlamentarRecord extends ParlamentarInput {
  nomeCivil: string | null;
  situacao: string | null;
}

export interface ParlamentarWriteResult {
  inserted: number;
  updated: number;
  unchanged: number;
}

export type ParlamentarChangeState = 'INSERTED' | 'UPDATED' | 'UNCHANGED';

export interface ClassifiedParlamentar {
  state: ParlamentarChangeState;
  item: ParlamentarInput;
}

export interface ParlamentarRepositoryContract {
  upsertMany(items: ParlamentarInput[]): Promise<ParlamentarWriteResult>;
  list(query: {
    source: ParlamentarSource;
    page: number;
    limit: number;
  }): Promise<{ data: ParlamentarRecord[]; total: number }>;
  findByExternalId(identity: {
    source: ParlamentarSource;
    externalId: number;
  }): Promise<ParlamentarRecord | null>;
}
