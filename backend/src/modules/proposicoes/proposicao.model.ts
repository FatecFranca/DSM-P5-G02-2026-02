import mongoose, { type Model } from 'mongoose';

import type {
  ProposicaoAutor,
  ProposicaoMlClassification,
  ProposicaoSource,
  ProposicaoTemaOficial,
} from './proposicao.types.js';

export interface ProposicaoPersistence {
  externalId: number;
  source: ProposicaoSource;
  tipo: string;
  numero: number;
  ano: number;
  ementa: string | null;
  descricao: string | null;
  dataApresentacao: Date | null;
  situacao: string | null;
  uri: string;
  urlFonte: string | null;
  autores: ProposicaoAutor[];
  temasOficiais: ProposicaoTemaOficial[];
  mlClassification?: ProposicaoMlClassification | null;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const autorSchema = new mongoose.Schema<ProposicaoAutor>(
  {
    externalId: { type: Number, default: null },
    nome: { type: String, required: true, trim: true },
    tipo: { type: String, required: true, trim: true },
    uri: { type: String, default: null },
    parlamentarExternalId: { type: Number, default: null },
  },
  { _id: false },
);

const temaSchema = new mongoose.Schema<ProposicaoTemaOficial>(
  {
    codTema: { type: Number, required: true },
    tema: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const mlThemeSchema = new mongoose.Schema(
  {
    codTema: { type: Number, required: true },
    tema: { type: String, required: true, trim: true },
    origin: { type: String, enum: ['ML'], required: true },
    decisionScore: { type: Number, required: true },
  },
  { _id: false },
);

const mlClassificationSchema = new mongoose.Schema<ProposicaoMlClassification>(
  {
    status: {
      type: String,
      enum: ['CLASSIFIED', 'NO_LABEL'],
      required: true,
    },
    modelName: { type: String, required: true, trim: true },
    modelVersion: { type: String, required: true, trim: true },
    modelSource: { type: String, enum: ['CAMARA'], required: true },
    modelYears: { type: [Number], required: true },
    inputHash: { type: String, required: true, trim: true },
    classifiedAt: { type: Date, required: true },
    labels: { type: [mlThemeSchema], default: [] },
  },
  { _id: false },
);

export const proposicaoSchema = new mongoose.Schema<ProposicaoPersistence>(
  {
    externalId: { type: Number, required: true },
    source: { type: String, enum: ['CAMARA', 'SENADO'], required: true },
    tipo: { type: String, required: true, trim: true },
    numero: { type: Number, required: true },
    ano: { type: Number, required: true },
    ementa: { type: String, default: null, trim: true },
    descricao: { type: String, default: null, trim: true },
    dataApresentacao: { type: Date, default: null },
    situacao: { type: String, default: null, trim: true },
    uri: { type: String, required: true },
    urlFonte: { type: String, default: null },
    autores: { type: [autorSchema], default: [] },
    temasOficiais: { type: [temaSchema], default: [] },
    mlClassification: { type: mlClassificationSchema, default: null },
    fetchedAt: { type: Date, required: true },
  },
  { collection: 'proposicoes', timestamps: true },
);

proposicaoSchema.index({ source: 1, externalId: 1 }, { unique: true });
proposicaoSchema.index({ source: 1, ano: 1, tipo: 1, externalId: 1 });
proposicaoSchema.index({ source: 1, ano: 1, externalId: 1 });
proposicaoSchema.index({
  source: 1,
  'autores.parlamentarExternalId': 1,
  ano: 1,
});

export const ProposicaoModel =
  (mongoose.models.Proposicao as Model<ProposicaoPersistence> | undefined) ??
  mongoose.model<ProposicaoPersistence>('Proposicao', proposicaoSchema);
