import mongoose, { type Model } from 'mongoose';

import type { MaterializedThemeProfilePersistence } from './materialized-theme-profile.types.js';

const themeSchema = new mongoose.Schema(
  {
    code: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    documentCount: { type: Number, required: true, min: 1 },
    share: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false },
);

const materializedThemeProfileSchema =
  new mongoose.Schema<MaterializedThemeProfilePersistence>(
    {
      source: { type: String, enum: ['CAMARA'], required: true },
      parliamentarianExternalId: { type: Number, required: true, min: 1 },
      periodStartYear: { type: Number, required: true, min: 1900, max: 2100 },
      periodEndYear: { type: Number, required: true, min: 1900, max: 2100 },
      themeSource: {
        type: String,
        enum: ['official', 'enriched'],
        required: true,
      },
      documentsAnalyzed: { type: Number, required: true, min: 0 },
      documentsWithThemes: { type: Number, required: true, min: 0 },
      documentsWithOfficialThemes: { type: Number, required: true, min: 0 },
      documentsWithMLThemes: { type: Number, required: true, min: 0 },
      documentsWithoutThemes: { type: Number, required: true, min: 0 },
      coverage: { type: Number, required: true, min: 0, max: 1 },
      officialCoverage: { type: Number, required: true, min: 0, max: 1 },
      enrichedCoverage: { type: Number, required: true, min: 0, max: 1 },
      totalThemeOccurrences: { type: Number, required: true, min: 0 },
      themes: { type: [themeSchema], default: [] },
      generatedAt: { type: Date, required: true },
      dataVersion: { type: String, required: true, trim: true },
      modelVersion: { type: String, required: false, trim: true },
      modelVersions: { type: [String], default: [] },
    },
    {
      collection: 'parliamentarian_theme_profiles',
      timestamps: true,
    },
  );

materializedThemeProfileSchema.index(
  {
    source: 1,
    parliamentarianExternalId: 1,
    periodStartYear: 1,
    periodEndYear: 1,
    themeSource: 1,
  },
  { unique: true },
);

materializedThemeProfileSchema.index({
  source: 1,
  periodStartYear: 1,
  periodEndYear: 1,
  themeSource: 1,
  parliamentarianExternalId: 1,
});

export const MaterializedThemeProfileModel =
  (mongoose.models.MaterializedThemeProfile as
    Model<MaterializedThemeProfilePersistence> | undefined) ??
  mongoose.model<MaterializedThemeProfilePersistence>(
    'MaterializedThemeProfile',
    materializedThemeProfileSchema,
  );
