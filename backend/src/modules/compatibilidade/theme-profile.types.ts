export interface ThemePeriod {
  startYear: number;
  endYear: number;
}

export type ThemeSourceMode = 'official' | 'enriched';
export type ThemeOrigin = 'OFFICIAL' | 'ML';

export interface ProfileParliamentarian {
  id: number;
  name: string;
  party: string | null;
  uf: string | null;
}

export interface ThemeProfileItem {
  code: number;
  name: string;
  documentCount: number;
  share: number;
}

export interface ThemeEvidence {
  proposalId: number;
  themeCode: number;
  title: string;
  source: 'CAMARA';
  themeOrigin: ThemeOrigin;
  decisionScore?: number;
  modelName?: string;
  modelVersion?: string;
}

export interface RankedThemeEvidence extends ThemeEvidence {
  parliamentarianId: number;
}

export interface ParliamentarianThemeProfile {
  parliamentarian: ProfileParliamentarian;
  source: 'CAMARA';
  period: ThemePeriod;
  themeSource: ThemeSourceMode;
  documentsAnalyzed: number;
  documentsWithThemes: number;
  documentsWithOfficialThemes: number;
  documentsWithMLThemes: number;
  documentsWithoutThemes: number;
  coverage: number;
  officialCoverage: number;
  enrichedCoverage: number;
  themes: ThemeProfileItem[];
}

export interface ComparableThemeProfile extends ParliamentarianThemeProfile {
  evidence: ThemeEvidence[];
}

export interface ProfileSummaryAggregation {
  parliamentarianId: number;
  documentsAnalyzed: number;
  documentsWithThemes: number;
  documentsWithOfficialThemes?: number;
  documentsWithMLThemes?: number;
  documentsWithEnrichedThemes?: number;
  modelVersions?: string[];
}

export interface ThemeCountAggregation {
  parliamentarianId: number;
  themeCode: number;
  documentCount: number;
}

export interface EvidenceAggregation {
  parliamentarianId: number;
  themeCode: number;
  documents: Array<{
    proposalId: number;
    title: string;
    themeOrigin?: ThemeOrigin;
    decisionScore?: number;
    modelName?: string;
    modelVersion?: string;
  }>;
}

export interface ProfileAggregation {
  summaries: ProfileSummaryAggregation[];
  themes: ThemeCountAggregation[];
  evidence: EvidenceAggregation[];
}

export interface AggregateProfilesQuery extends ThemePeriod {
  parliamentarianId?: number;
  themeSource?: ThemeSourceMode;
}

export interface AggregateEvidenceQuery extends ThemePeriod {
  parliamentarianIds: number[];
  themeCodes: number[];
  themeSource?: ThemeSourceMode;
}

export interface ThemeProfileRepositoryContract {
  findDeputy(id: number): Promise<ProfileParliamentarian | null>;
  listDeputies(): Promise<ProfileParliamentarian[]>;
  aggregateProfiles(query: AggregateProfilesQuery): Promise<ProfileAggregation>;
  aggregateEvidence(
    query: AggregateEvidenceQuery,
  ): Promise<EvidenceAggregation[]>;
}

export interface ComparableProfiles {
  source: 'CAMARA';
  period: ThemePeriod;
  themeSource: ThemeSourceMode;
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
  profiles: ComparableThemeProfile[];
}

export interface ThemeProfileServiceContract {
  getProfile(
    id: number,
    period?: ThemePeriod,
    themeSource?: ThemeSourceMode,
  ): Promise<ParliamentarianThemeProfile>;
}

export interface ThemeProfilesProvider {
  getComparableProfiles(
    period?: ThemePeriod,
    themeSource?: ThemeSourceMode,
  ): Promise<ComparableProfiles>;
  getEvidence(
    period: ThemePeriod,
    parliamentarianIds: number[],
    themeCodes: number[],
    themeSource?: ThemeSourceMode,
  ): Promise<RankedThemeEvidence[]>;
}
