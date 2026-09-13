import { DeputadoNotFoundError } from '../../integrations/camara/camara.errors.js';
import { ThemeProfilesNotReadyError } from './compatibility.errors.js';
import type {
  MaterializedThemeProfilePersistence,
  MaterializedThemeProfileRepositoryContract,
  MaterializedThemeProfileScope,
} from './materialized-theme-profile.types.js';
import {
  DEFAULT_THEME_PERIOD,
  validateThemePeriod,
} from './theme-profile.service.js';
import type {
  ComparableProfiles,
  ComparableThemeProfile,
  ParliamentarianThemeProfile,
  ProfileParliamentarian,
  RankedThemeEvidence,
  ThemePeriod,
  ThemeProfileRepositoryContract,
  ThemeProfileServiceContract,
  ThemeProfilesProvider,
  ThemeSourceMode,
} from './theme-profile.types.js';

interface MaterializedThemeProfileServiceDependencies {
  sourceRepository: ThemeProfileRepositoryContract;
  sourceProvider: ThemeProfilesProvider;
  sourceProfileService: ThemeProfileServiceContract;
  materializedRepository: MaterializedThemeProfileRepositoryContract;
}

function scopeOf(
  period: ThemePeriod,
  themeSource: ThemeSourceMode,
): MaterializedThemeProfileScope {
  return { source: 'CAMARA', ...period, themeSource };
}

function toProfile(
  record: MaterializedThemeProfilePersistence,
  parliamentarian: ProfileParliamentarian,
): ComparableThemeProfile {
  return {
    parliamentarian,
    source: 'CAMARA',
    period: {
      startYear: record.periodStartYear,
      endYear: record.periodEndYear,
    },
    themeSource: record.themeSource,
    documentsAnalyzed: record.documentsAnalyzed,
    documentsWithThemes: record.documentsWithThemes,
    documentsWithOfficialThemes: record.documentsWithOfficialThemes,
    documentsWithMLThemes: record.documentsWithMLThemes,
    documentsWithoutThemes: record.documentsWithoutThemes,
    coverage: record.coverage,
    officialCoverage: record.officialCoverage,
    enrichedCoverage: record.enrichedCoverage,
    themes: record.themes,
    evidence: [],
  };
}

export class MaterializedThemeProfileService
  implements ThemeProfileServiceContract, ThemeProfilesProvider
{
  constructor(
    private readonly dependencies: MaterializedThemeProfileServiceDependencies,
  ) {}

  async getProfile(
    id: number,
    period: ThemePeriod = DEFAULT_THEME_PERIOD,
    themeSource: ThemeSourceMode = 'official',
  ): Promise<ParliamentarianThemeProfile> {
    validateThemePeriod(period);
    const parliamentarian =
      await this.dependencies.sourceRepository.findDeputy(id);
    if (!parliamentarian) throw new DeputadoNotFoundError();
    const record = await this.dependencies.materializedRepository.findProfile(
      scopeOf(period, themeSource),
      id,
    );
    if (!record) {
      return this.dependencies.sourceProfileService.getProfile(
        id,
        period,
        themeSource,
      );
    }
    const { evidence, ...profile } = toProfile(record, parliamentarian);
    void evidence;
    return profile;
  }

  async getComparableProfiles(
    period: ThemePeriod = DEFAULT_THEME_PERIOD,
    themeSource: ThemeSourceMode = 'official',
  ): Promise<ComparableProfiles> {
    validateThemePeriod(period);
    const [parliamentarians, records] = await Promise.all([
      this.dependencies.sourceRepository.listDeputies(),
      this.dependencies.materializedRepository.listProfiles(
        scopeOf(period, themeSource),
      ),
    ]);
    const recordById = new Map(
      records.map((record) => [record.parliamentarianExternalId, record]),
    );
    if (
      records.length !== parliamentarians.length ||
      parliamentarians.some(({ id }) => !recordById.has(id))
    ) {
      throw new ThemeProfilesNotReadyError();
    }
    const allProfiles = parliamentarians.map((parliamentarian) =>
      toProfile(recordById.get(parliamentarian.id)!, parliamentarian),
    );
    const profiles = allProfiles.filter(({ themes }) => themes.length > 0);
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

  getEvidence(
    period: ThemePeriod,
    parliamentarianIds: number[],
    themeCodes: number[],
    themeSource: ThemeSourceMode = 'official',
  ): Promise<RankedThemeEvidence[]> {
    return this.dependencies.sourceProvider.getEvidence(
      period,
      parliamentarianIds,
      themeCodes,
      themeSource,
    );
  }
}
