import mongoose, { type Model } from 'mongoose';

import type { SyncResource, SyncStatus } from './sync.types.js';

interface SyncLogPersistence {
  source: 'CAMARA' | 'SENADO';
  resource: SyncResource;
  period?: { startYear: number; endYear: number };
  startedAt: Date;
  finishedAt?: Date;
  status: SyncStatus;
  processed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: string[];
  createdAt: Date;
  updatedAt: Date;
}

const syncLogSchema = new mongoose.Schema<SyncLogPersistence>(
  {
    source: { type: String, enum: ['CAMARA', 'SENADO'], required: true },
    resource: {
      type: String,
      enum: [
        'DEPUTADOS',
        'PROPOSICOES',
        'HISTORICAL_PROPOSITIONS',
        'ML_THEME_ENRICHMENT',
        'SENADORES',
        'MATERIAS',
        'INDICADORES',
      ],
      required: true,
    },
    period: {
      type: {
        startYear: { type: Number, required: true },
        endYear: { type: Number, required: true },
      },
      required: false,
      _id: false,
    },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date },
    status: {
      type: String,
      enum: ['RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL'],
      required: true,
    },
    processed: { type: Number, required: true, min: 0, default: 0 },
    inserted: { type: Number, required: true, min: 0, default: 0 },
    updated: { type: Number, required: true, min: 0, default: 0 },
    unchanged: { type: Number, required: true, min: 0, default: 0 },
    errors: { type: [String], default: [] },
  },
  {
    collection: 'sync_logs',
    suppressReservedKeysWarning: true,
    timestamps: true,
  },
);

export const SyncLogModel =
  (mongoose.models.SyncLog as Model<SyncLogPersistence> | undefined) ??
  mongoose.model<SyncLogPersistence>('SyncLog', syncLogSchema);
