export type ProposicaoSource = 'CAMARA' | 'SENADO';

export interface ProposicaoAutor {
  externalId: number | null;
  nome: string;
  tipo: string;
  uri: string | null;
  parlamentarExternalId: number | null;
}

export interface ProposicaoTemaOficial {
  codTema: number;
  tema: string;
}

export interface ProposicaoMlTheme {
  codTema: number;
  tema: string;
  origin: 'ML';
  decisionScore: number;
}

export interface ProposicaoMlClassification {
  status: 'CLASSIFIED' | 'NO_LABEL';
  modelName: string;
  modelVersion: string;
  modelSource: 'CAMARA';
  modelYears: number[];
  inputHash: string;
  classifiedAt: Date;
  labels: ProposicaoMlTheme[];
}

export interface ProposicaoInput {
  externalId: number;
  source: ProposicaoSource;
  tipo: string;
  numero: number;
  ano: number;
  ementa: string | null;
  descricao?: string | null;
  dataApresentacao: Date | null;
  situacao?: string | null;
  uri: string;
  urlFonte: string | null;
  autores: ProposicaoAutor[];
  temasOficiais: ProposicaoTemaOficial[];
  fetchedAt: Date;
}

export interface ProposicaoRecord extends ProposicaoInput {
  descricao: string | null;
  situacao: string | null;
}

export type ProposicaoChangeState = 'INSERTED' | 'UPDATED' | 'UNCHANGED';

export interface ClassifiedProposicao {
  state: ProposicaoChangeState;
  item: ProposicaoInput;
}

export interface ProposicaoWriteResult {
  inserted: number;
  updated: number;
  unchanged: number;
}

export interface ProposicaoListQuery {
  source: ProposicaoSource;
  page: number;
  limit: number;
  ano?: number;
  tipo?: string;
  parlamentarExternalId?: number;
}

export interface ProposicaoRepositoryContract {
  upsertMany(items: ProposicaoInput[]): Promise<ProposicaoWriteResult>;
  list(
    query: ProposicaoListQuery,
  ): Promise<{ data: ProposicaoRecord[]; total: number }>;
  findByExternalId(identity: {
    source: ProposicaoSource;
    externalId: number;
  }): Promise<ProposicaoRecord | null>;
}
