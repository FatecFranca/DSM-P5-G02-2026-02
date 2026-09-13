import mongoose, { type Model } from 'mongoose';

import type {
  CasaLegislativa,
  ParlamentarSource,
} from './parlamentar.types.js';

export interface ParlamentarPersistence {
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
  createdAt: Date;
  updatedAt: Date;
}

export const parlamentarSchema = new mongoose.Schema<ParlamentarPersistence>(
  {
    externalId: { type: Number, required: true },
    source: {
      type: String,
      enum: ['CAMARA', 'SENADO'],
      required: true,
    },
    casa: {
      type: String,
      enum: ['CAMARA', 'SENADO'],
      required: true,
    },
    nome: { type: String, required: true, trim: true },
    nomeCivil: { type: String, default: null, trim: true },
    partido: { type: String, default: null, trim: true },
    uf: { type: String, default: null, trim: true },
    fotoUrl: { type: String, default: null },
    email: { type: String, default: null, trim: true },
    situacao: { type: String, default: null, trim: true },
    legislatura: { type: Number, default: null },
    fetchedAt: { type: Date, required: true },
  },
  {
    collection: 'parlamentares',
    timestamps: true,
  },
);

parlamentarSchema.index({ source: 1, externalId: 1 }, { unique: true });
parlamentarSchema.index({ source: 1, nome: 1, externalId: 1 });

export const ParlamentarModel =
  (mongoose.models.Parlamentar as Model<ParlamentarPersistence> | undefined) ??
  mongoose.model<ParlamentarPersistence>('Parlamentar', parlamentarSchema);
