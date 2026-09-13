import type { ParlamentarSource } from '../parlamentares/parlamentar.types.js';

export type IndicadorSource = ParlamentarSource;

export interface VotacaoInput {
  source: IndicadorSource;
  externalId: string;
  data: Date;
  descricao?: string | null;
  resultado?: string | null;
  casa: string;
  proposicaoExternalId?: number | null;
  fetchedAt: Date;
}

export interface VotacaoRecord extends VotacaoInput {
  descricao: string | null;
  resultado: string | null;
  proposicaoExternalId: number | null;
}

export interface VotoInput {
  source: IndicadorSource;
  votacaoExternalId: string;
  parlamentarExternalId: number;
  voto: string;
  data: Date;
  fetchedAt: Date;
}

export type VotoRecord = VotoInput;

export interface ParticipacaoOrgaoInput {
  source: IndicadorSource;
  orgaoExternalId: number;
  parlamentarExternalId: number;
  sigla: string;
  nome: string;
  casa: string;
  funcao?: string | null;
  inicio?: Date | null;
  fim?: Date | null;
  fetchedAt: Date;
}

export interface ParticipacaoOrgaoRecord extends ParticipacaoOrgaoInput {
  funcao: string | null;
  inicio: Date | null;
  fim: Date | null;
}

export interface IndicadorWriteResult {
  inserted: number;
  updated: number;
  unchanged: number;
}

export type IndicadorChangeState = 'INSERTED' | 'UPDATED' | 'UNCHANGED';

export interface ClassifiedIndicador<T> {
  state: IndicadorChangeState;
  item: T;
}

export interface VotacaoRepositoryContract {
  upsertMany(items: VotacaoInput[]): Promise<IndicadorWriteResult>;
}

export interface VotoRepositoryContract {
  upsertMany(items: VotoInput[]): Promise<IndicadorWriteResult>;
}

export interface ParticipacaoOrgaoRepositoryContract {
  upsertMany(items: ParticipacaoOrgaoInput[]): Promise<IndicadorWriteResult>;
}
