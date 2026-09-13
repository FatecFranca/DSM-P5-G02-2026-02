import type {
  ThemeProfileItem,
  ThemeSourceMode,
} from './theme-profile.types.js';

export interface MaterializedThemeProfileScope {
  source: 'CAMARA';
  startYear: number;
  endYear: number;
  themeSource: ThemeSourceMode;
}

export interface MaterializedThemeProfileInput {
  source: 'CAMARA';
  parliamentarianExternalId: number;
  periodStartYear: number;
  periodEndYear: number;
  themeSource: ThemeSourceMode;
  documentsAnalyzed: number;
  documentsWithThemes: number;
  documentsWithOfficialThemes: number;
  documentsWithMLThemes: number;
  documentsWithoutThemes: number;
  coverage: number;
  officialCoverage: number;
  enrichedCoverage: number;
  totalThemeOccurrences: number;
  themes: ThemeProfileItem[];
  dataVersion: string;
  modelVersion?: string;
  modelVersions: string[];
}

export interface MaterializedThemeProfilePersistence extends MaterializedThemeProfileInput {
  generatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MaterializedThemeProfileWriteResult {
  inserted: number;
  updated: number;
  unchanged: number;
  deleted: number;
}

export interface ReplaceMaterializedProfileOptions {
  dryRun: boolean;
  batchSize: number;
  generatedAt: Date;
}

export interface MaterializedThemeProfileRepositoryContract {
  findProfile(
    scope: MaterializedThemeProfileScope,
    parliamentarianExternalId: number,
  ): Promise<MaterializedThemeProfilePersistence | null>;
  listProfiles(
    scope: MaterializedThemeProfileScope,
  ): Promise<MaterializedThemeProfilePersistence[]>;
  countProfiles(scope: MaterializedThemeProfileScope): Promise<number>;
  replaceScope(
    scope: MaterializedThemeProfileScope,
    profiles: MaterializedThemeProfileInput[],
    options: ReplaceMaterializedProfileOptions,
  ): Promise<MaterializedThemeProfileWriteResult>;
}

export interface ThemeProfileMaterializationOptions extends MaterializedThemeProfileScope {
  dryRun: boolean;
  batchSize: number;
}

export interface ThemeProfileMaterializationCliOptions {
  source: 'CAMARA';
  startYear: number;
  endYear: number;
  themeSource: ThemeSourceMode | 'all';
  dryRun: boolean;
  batchSize: number;
}

export interface ThemeProfileMaterializationSummary extends MaterializedThemeProfileWriteResult {
  source: 'CAMARA';
  period: { startYear: number; endYear: number };
  themeSource: ThemeSourceMode;
  dryRun: boolean;
  status: 'SUCCESS';
  candidates: number;
  profiles: number;
  withoutData: number;
  modelVersions: string[];
  durationMs: number;
}
