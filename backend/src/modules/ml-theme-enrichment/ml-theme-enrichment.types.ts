import type { ProposicaoMlClassification } from '../proposicoes/proposicao.types.js';

export interface MlThemeEnrichmentOptions {
  startYear: number;
  endYear: number;
  dryRun: boolean;
  limit?: number;
  concurrency: number;
  batchSize: number;
  retries: number;
}

export interface MlEnrichmentCandidate {
  externalId: number;
  ementa: string | null;
  mlClassification: ProposicaoMlClassification | null;
}

export interface MlThemeSelectionStats {
  propositionsTotal: number;
  official: number;
  uncovered: number;
}

export interface MlClassificationUpdate {
  externalId: number;
  classification: ProposicaoMlClassification;
}

export interface MlClassificationWriteResult {
  classified: number;
  noLabel: number;
  skippedOfficialRace: number;
}

export interface MlThemeEnrichmentRepositoryContract {
  countScope(query: {
    startYear: number;
    endYear: number;
  }): Promise<MlThemeSelectionStats>;
  listUncoveredPage(query: {
    startYear: number;
    endYear: number;
    afterExternalId?: number;
    limit: number;
  }): Promise<MlEnrichmentCandidate[]>;
  saveClassifications(
    updates: MlClassificationUpdate[],
  ): Promise<MlClassificationWriteResult>;
}

export interface MlThemeEnrichmentSummary extends MlThemeSelectionStats {
  source: 'CAMARA';
  resource: 'ML_THEME_ENRICHMENT';
  period: { startYear: number; endYear: number };
  modelName: string;
  modelVersion: string;
  dryRun: boolean;
  status: 'SUCCESS' | 'PARTIAL';
  withUsableText: number;
  withoutText: number;
  alreadyProcessed: number;
  pending: number;
  attempted: number;
  processed: number;
  classifiedWithLabels: number;
  processedWithoutLabel: number;
  labelsGenerated: number;
  skippedOfficialRace: number;
  failures: number;
  errors: string[];
  performance: {
    totalMs: number;
    predictionMs: number;
    writeMs: number;
    documentsPerSecond: number;
  };
}
