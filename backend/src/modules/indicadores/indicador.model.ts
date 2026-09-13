import mongoose, { type Model } from 'mongoose';

import type {
  IndicadorSource,
  ParticipacaoOrgaoRecord,
  VotacaoRecord,
  VotoRecord,
} from './indicador.types.js';

interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

export interface VotacaoPersistence extends VotacaoRecord, Timestamps {}
export interface VotoPersistence extends VotoRecord, Timestamps {}
export interface ParticipacaoOrgaoPersistence
  extends ParticipacaoOrgaoRecord, Timestamps {}

const sourceField = {
  type: String,
  enum: ['CAMARA', 'SENADO'],
  required: true,
} as const;

const votacaoSchema = new mongoose.Schema<VotacaoPersistence>(
  {
    source: sourceField,
    externalId: { type: String, required: true, trim: true },
    data: { type: Date, required: true },
    descricao: { type: String, default: null, trim: true },
    resultado: { type: String, default: null, trim: true },
    casa: { type: String, required: true, trim: true },
    proposicaoExternalId: { type: Number, default: null },
    fetchedAt: { type: Date, required: true },
  },
  { collection: 'votacoes', timestamps: true },
);

const votoSchema = new mongoose.Schema<VotoPersistence>(
  {
    source: sourceField,
    votacaoExternalId: { type: String, required: true, trim: true },
    parlamentarExternalId: { type: Number, required: true },
    voto: { type: String, required: true, trim: true },
    data: { type: Date, required: true },
    fetchedAt: { type: Date, required: true },
  },
  { collection: 'votos', timestamps: true },
);

const participacaoOrgaoSchema =
  new mongoose.Schema<ParticipacaoOrgaoPersistence>(
    {
      source: sourceField,
      orgaoExternalId: { type: Number, required: true },
      parlamentarExternalId: { type: Number, required: true },
      sigla: { type: String, required: true, trim: true },
      nome: { type: String, required: true, trim: true },
      casa: { type: String, required: true, trim: true },
      funcao: { type: String, default: null, trim: true },
      inicio: { type: Date, default: null },
      fim: { type: Date, default: null },
      fetchedAt: { type: Date, required: true },
    },
    { collection: 'participacoes_orgaos', timestamps: true },
  );

votacaoSchema.index({ source: 1, externalId: 1 }, { unique: true });
votacaoSchema.index({ source: 1, data: 1 });
votoSchema.index(
  { source: 1, votacaoExternalId: 1, parlamentarExternalId: 1 },
  { unique: true },
);
votoSchema.index({ source: 1, parlamentarExternalId: 1, data: 1 });
participacaoOrgaoSchema.index(
  {
    source: 1,
    parlamentarExternalId: 1,
    orgaoExternalId: 1,
    funcao: 1,
    inicio: 1,
  },
  { unique: true },
);
participacaoOrgaoSchema.index({ source: 1, parlamentarExternalId: 1 });

export const VotacaoModel =
  (mongoose.models.Votacao as Model<VotacaoPersistence> | undefined) ??
  mongoose.model<VotacaoPersistence>('Votacao', votacaoSchema);

export const VotoModel =
  (mongoose.models.Voto as Model<VotoPersistence> | undefined) ??
  mongoose.model<VotoPersistence>('Voto', votoSchema);

export const ParticipacaoOrgaoModel =
  (mongoose.models.ParticipacaoOrgao as
    Model<ParticipacaoOrgaoPersistence> | undefined) ??
  mongoose.model<ParticipacaoOrgaoPersistence>(
    'ParticipacaoOrgao',
    participacaoOrgaoSchema,
  );

export type { IndicadorSource };
