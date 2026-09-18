import { DeputadoNotFoundError } from '../../integrations/camara/camara.errors.js';
import { getCamaraTheme } from '../temas/camara-temas.catalog.js';
import { ThemeProfileInvalidPeriodError } from './compatibility.errors.js';
import type {
  ComparableProfiles,
  ComparableThemeProfile,
  ParliamentarianThemeProfile,
  ProfileAggregation,
  ProfileParliamentarian,
  ThemePeriod,
  RankedThemeEvidence,
  ThemeProfileRepositoryContract,
  ThemeProfileServiceContract,
  ThemeProfilesProvider,
  ThemeSourceMode,
} from './theme-profile.types.js';

export const DEFAULT_THEME_PERIOD: ThemePeriod = Object.freeze({
  startYear: 2023,
  endYear: 2025,
});

export function validateThemePeriod(period: ThemePeriod): void {
  if (
    !Number.isInteger(period.startYear) ||
    !Number.isInteger(period.endYear) ||
    period.startYear < 1900 ||
    period.endYear > 2100 ||
    period.startYear > period.endYear
  ) {
    throw new ThemeProfileInvalidPeriodError();
  }
}

export function buildComparableThemeProfile(
  parliamentarian: ProfileParliamentarian,
  period: ThemePeriod,
  aggregation: ProfileAggregation,
  themeSource: ThemeSourceMode,
): ComparableThemeProfile {
  const summary = aggregation.summaries.find(
    (item) => item.parliamentarianId === parliamentarian.id,
  );
  const counts = aggregation.themes
    .filter((item) => item.parliamentarianId === parliamentarian.id)
    .flatMap((item) => {
      const theme = getCamaraTheme(item.themeCode);
      return theme && item.documentCount > 0 ? [{ ...item, theme }] : [];
    });
  const totalThemeOccurrences = counts.reduce(
    (sum, item) => sum + item.documentCount,
    0,
  );
  const documentsAnalyzed = summary?.documentsAnalyzed ?? 0;
  const documentsWithThemes = summary?.documentsWithThemes ?? 0;
  const documentsWithOfficialThemes =
    summary?.documentsWithOfficialThemes ?? documentsWithThemes;
  const documentsWithMLThemes = summary?.documentsWithMLThemes ?? 0;
  const documentsWithEnrichedThemes =
    summary?.documentsWithEnrichedThemes ??
    documentsWithOfficialThemes + documentsWithMLThemes;
  const evidence = aggregation.evidence
    .filter((item) => item.parliamentarianId === parliamentarian.id)
    .flatMap((item) =>
      item.documents.map((document) => ({
        proposalId: document.proposalId,
        themeCode: item.themeCode,
        title: document.title,
        source: 'CAMARA' as const,
        themeOrigin: document.themeOrigin ?? ('OFFICIAL' as const),
        ...(document.decisionScore === undefined
          ? {}
          : { decisionScore: document.decisionScore }),
        ...(document.modelName === undefined
          ? {}
          : { modelName: document.modelName }),
        ...(document.modelVersion === undefined
          ? {}
          : { modelVersion: document.modelVersion }),
      })),
    );

  return {
    parliamentarian,
    source: 'CAMARA',
    period,
    themeSource,
    documentsAnalyzed,
    documentsWithThemes,
    documentsWithOfficialThemes,
    documentsWithMLThemes,
    documentsWithoutThemes: documentsAnalyzed - documentsWithThemes,
    coverage:
      documentsAnalyzed === 0 ? 0 : documentsWithThemes / documentsAnalyzed,
    officialCoverage:
      documentsAnalyzed === 0
        ? 0
        : documentsWithOfficialThemes / documentsAnalyzed,
    enrichedCoverage:
      documentsAnalyzed === 0
        ? 0
        : documentsWithEnrichedThemes / documentsAnalyzed,
    themes: counts
      .map(({ theme, documentCount }) => ({
        code: theme.code,
        name: theme.name,
        documentCount,
        share:
          totalThemeOccurrences === 0
            ? 0
            : documentCount / totalThemeOccurrences,
      }))
      .sort(
        (left, right) => right.share - left.share || left.code - right.code,
      ),
    evidence,
  };
}

export class ThemeProfileService
  implements ThemeProfileServiceContract, ThemeProfilesProvider
{
  constructor(private readonly repository: ThemeProfileRepositoryContract) {}

  async getProfile(
    id: number,
    period: ThemePeriod = DEFAULT_THEME_PERIOD,
    themeSource: ThemeSourceMode = 'official',
  ): Promise<ParliamentarianThemeProfile> {
    validateThemePeriod(period);
    const parliamentarian = await this.repository.findDeputy(id);
    if (!parliamentarian) throw new DeputadoNotFoundError();

    const aggregation = await this.repository.aggregateProfiles({
      ...period,
      parliamentarianId: id,
      themeSource,
    });
    const comparableProfile = buildComparableThemeProfile(
      parliamentarian,
      period,
      aggregation,
      themeSource,
    );
    return {
      parliamentarian: comparableProfile.parliamentarian,
      source: comparableProfile.source,
      period: comparableProfile.period,
      themeSource: comparableProfile.themeSource,
      documentsAnalyzed: comparableProfile.documentsAnalyzed,
      documentsWithThemes: comparableProfile.documentsWithThemes,
      documentsWithOfficialThemes:
        comparableProfile.documentsWithOfficialThemes,
      documentsWithMLThemes: comparableProfile.documentsWithMLThemes,
      documentsWithoutThemes: comparableProfile.documentsWithoutThemes,
      coverage: comparableProfile.coverage,
      officialCoverage: comparableProfile.officialCoverage,
      enrichedCoverage: comparableProfile.enrichedCoverage,
      themes: comparableProfile.themes,
    };
  }

  async getComparableProfiles(
    period: ThemePeriod = DEFAULT_THEME_PERIOD,
    themeSource: ThemeSourceMode = 'official',
  ): Promise<ComparableProfiles> {
    validateThemePeriod(period);
    const [parliamentarians, aggregation] = await Promise.all([
      this.repository.listDeputies(),
      this.repository.aggregateProfiles({ ...period, themeSource }),
    ]);
    const allProfiles = parliamentarians.map((parliamentarian) =>
      buildComparableThemeProfile(
        parliamentarian,
        period,
        aggregation,
        themeSource,
      ),
    );
    const profiles = allProfiles.filter((profile) => profile.themes.length > 0);
    const documentsAnalyzed = allProfiles.reduce(
      (sum, profile) => sum + profile.documentsAnalyzed,
      0,
    );
    const documentsWithThemes = allProfiles.reduce(
      (sum, profile) => sum + profile.documentsWithThemes,
      0,
    );
    const documentsWithOfficialThemes = allProfiles.reduce(
      (sum, profile) => sum + profile.documentsWithOfficialThemes,
      0,
    );
    const documentsWithMLThemes = allProfiles.reduce(
      (sum, profile) => sum + profile.documentsWithMLThemes,
      0,
    );
    const documentsWithEnrichedThemes = allProfiles.reduce(
      (sum, profile) =>
        sum + Math.round(profile.enrichedCoverage * profile.documentsAnalyzed),
      0,
    );

    return {
      source: 'CAMARA',
      period,
      themeSource,
      parliamentariansConsidered: parliamentarians.length,
      profilesCompared: profiles.length,
      profilesExcludedWithoutThemes: allProfiles.length - profiles.length,
      documentsAnalyzed,
      documentsWithThemes,
      documentsWithOfficialThemes,
      documentsWithMLThemes,
      coverage:
        documentsAnalyzed === 0 ? 0 : documentsWithThemes / documentsAnalyzed,
      officialCoverage:
        documentsAnalyzed === 0
          ? 0
          : documentsWithOfficialThemes / documentsAnalyzed,
      enrichedCoverage:
        documentsAnalyzed === 0
          ? 0
          : documentsWithEnrichedThemes / documentsAnalyzed,
      themesObserved: new Set(
        profiles.flatMap((profile) => profile.themes.map(({ code }) => code)),
      ).size,
      profiles,
    };
  }

  async getEvidence(
    period: ThemePeriod,
    parliamentarianIds: number[],
    themeCodes: number[],
    themeSource: ThemeSourceMode = 'official',
  ): Promise<RankedThemeEvidence[]> {
    validateThemePeriod(period);
    const rows = await this.repository.aggregateEvidence({
      ...period,
      parliamentarianIds,
      themeCodes,
      themeSource,
    });
    return rows.flatMap((row) =>
      row.documents.map((document) => ({
        parliamentarianId: row.parliamentarianId,
        proposalId: document.proposalId,
        themeCode: row.themeCode,
        title: document.title,
        source: 'CAMARA' as const,
        themeOrigin: document.themeOrigin ?? ('OFFICIAL' as const),
        ...(document.decisionScore === undefined
          ? {}
          : { decisionScore: document.decisionScore }),
        ...(document.modelName === undefined
          ? {}
          : { modelName: document.modelName }),
        ...(document.modelVersion === undefined
          ? {}
          : { modelVersion: document.modelVersion }),
      })),
    );
  }
}
