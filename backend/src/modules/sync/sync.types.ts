export type SyncStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
export type SyncResource =
  | 'DEPUTADOS'
  | 'PROPOSICOES'
  | 'HISTORICAL_PROPOSITIONS'
  | 'ML_THEME_ENRICHMENT'
  | 'SENADORES'
  | 'MATERIAS'
  | 'INDICADORES';

export interface SyncSummary {
  source: 'CAMARA';
  resource: 'DEPUTADOS';
  status: 'SUCCESS';
  processed: number;
  inserted: number;
  updated: number;
  unchanged: number;
}

export interface StartSyncLogInput {
  source: 'CAMARA' | 'SENADO';
  resource: SyncResource;
  period?: { startYear: number; endYear: number };
  startedAt: Date;
}

export interface FinishSyncLogInput {
  finishedAt: Date;
  status: Exclude<SyncStatus, 'RUNNING'>;
  processed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: string[];
}

export interface SyncLogRepositoryContract {
  start(input: StartSyncLogInput): Promise<{ id: string }>;
  finish(id: string, input: FinishSyncLogInput): Promise<void>;
}

export interface CamaraSyncServiceContract {
  syncDeputados(): Promise<SyncSummary>;
}

export interface ProposicaoSyncInput {
  ano: number;
  deputadoIds: number[];
  maxProposicoes: number;
}

export interface ProposicaoSyncSummary {
  source: 'CAMARA';
  resource: 'PROPOSICOES';
  status: 'SUCCESS' | 'PARTIAL';
  processed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: string[];
}

export interface ProposicaoSyncServiceContract {
  syncProposicoes(input: ProposicaoSyncInput): Promise<ProposicaoSyncSummary>;
}

export interface SenadoSyncSummary {
  source: 'SENADO';
  resource: 'SENADORES';
  status: 'SUCCESS';
  processed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: string[];
}

export interface SenadoSyncServiceContract {
  syncSenators(): Promise<SenadoSyncSummary>;
}

export interface SenadoMateriaSyncInput {
  ano: number;
  senadorIds: number[];
  siglas: string[];
  maxMaterias: number;
}

export interface SenadoMateriaSyncSummary {
  source: 'SENADO';
  resource: 'MATERIAS';
  status: 'SUCCESS' | 'PARTIAL';
  processed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: string[];
}

export interface SenadoMateriaSyncServiceContract {
  syncMaterias(
    input: SenadoMateriaSyncInput,
  ): Promise<SenadoMateriaSyncSummary>;
}

export interface IndicadorSyncInput {
  parlamentarExternalId: number;
  dataInicio: string;
  dataFim: string;
  maxVotacoes: number;
  maxOrgaos: number;
}

export interface CamaraIndicadorSyncInput extends IndicadorSyncInput {
  orgaoId?: number;
}

export interface IndicadorSyncSummary {
  source: 'CAMARA' | 'SENADO';
  resource: 'INDICADORES';
  status: 'SUCCESS' | 'PARTIAL';
  processed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: string[];
}

export interface CamaraIndicadorSyncServiceContract {
  syncIndicadores(
    input: CamaraIndicadorSyncInput,
  ): Promise<IndicadorSyncSummary>;
}

export interface SenadoIndicadorSyncServiceContract {
  syncIndicadores(input: IndicadorSyncInput): Promise<IndicadorSyncSummary>;
}
