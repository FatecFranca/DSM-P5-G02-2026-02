import type {
  ProfileParliamentarian,
  ThemeEvidence,
  ThemePeriod,
  ThemeSourceMode,
} from './theme-profile.types.js';

export interface ThemePreference {
  themeCode: number;
  weight: number;
}

export interface CompatibilityRequest {
  source: 'CAMARA';
  period?: ThemePeriod;
  themeSource?: ThemeSourceMode;
  preferences: ThemePreference[];
  limit?: number;
}

export interface MatchedTheme {
  code: number;
  name: string;
  userWeight: number;
  parliamentarianShare: number;
}

export interface CompatibilityResult {
  position: number;
  parliamentarian: ProfileParliamentarian;
  compatibility: number;
  compatibilityPercent: number;
  documentsAnalyzed: number;
  coverage: number;
  matchedThemes: MatchedTheme[];
  evidence: ThemeEvidence[];
}

export interface CompatibilityResponse {
  source: 'CAMARA';
  period: ThemePeriod;
  themeSource: ThemeSourceMode;
  method: 'cosine_similarity';
  results: CompatibilityResult[];
  summary: {
    parliamentariansConsidered: number;
    profilesCompared: number;
    profilesExcludedWithoutThemes: number;
    documentsAnalyzed: number;
    documentsWithThemes: number;
    documentsWithOfficialThemes: number;
    documentsWithMLThemes: number;
    coverage: number;
    officialCoverage: number;
    enrichedCoverage: number;
    themesObserved: number;
  };
}

export interface CompatibilityServiceContract {
  rank(request: CompatibilityRequest): Promise<CompatibilityResponse>;
}
