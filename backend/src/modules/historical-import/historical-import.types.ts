import type { ProposicaoAutor } from '../proposicoes/proposicao.types.js';

export interface HistoricalImportOptions {
  startYear: number;
  endYear: number;
  dataDir: string;
  dryRun: boolean;
  batchSize: number;
}

export interface HistoricalAuthorRow {
  propositionId: number;
  deputyId: number | null;
  author: ProposicaoAutor;
  signatureOrder: number;
  proponent: boolean;
}

export interface HistoricalThemeRow {
  propositionId: number;
  code: number;
  name: string;
}

export interface HistoricalYearSummary {
  year: number;
  propositions: number;
  propositionsWithThemes: number;
  propositionsWithoutThemes: number;
  propositionsWithDeputy: number;
  propositionsWithoutDeputy: number;
  associations: number;
}

export interface HistoricalImportSummary {
  source: 'CAMARA';
  resource: 'HISTORICAL_PROPOSITIONS';
  period: { startYear: number; endYear: number };
  dryRun: boolean;
  status: 'SUCCESS' | 'PARTIAL';
  propositionsRead: number;
  propositionsValid: number;
  themesRead: number;
  authorsRead: number;
  parliamentaryAuthors: number;
  parliamentaryAuthorsResolved: number;
  parliamentaryAuthorsUnresolved: number;
  nonParliamentaryAuthors: number;
  associations: number;
  propositionsWithThemes: number;
  propositionsWithoutThemes: number;
  propositionsWithDeputy: number;
  propositionsWithoutDeputy: number;
  estimatedUpserts: number;
  processed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  invalidRows: number;
  errors: string[];
  years: HistoricalYearSummary[];
  performance: {
    readAndParseMs: number;
    writeMs: number;
    totalMs: number;
  };
}
