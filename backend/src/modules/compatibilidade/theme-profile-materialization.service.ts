import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import type {
  MaterializedThemeProfileInput,
  MaterializedThemeProfileRepositoryContract,
  ThemeProfileMaterializationOptions,
  ThemeProfileMaterializationSummary,
} from './materialized-theme-profile.types.js';
import {
  buildComparableThemeProfile,
  validateThemePeriod,
} from './theme-profile.service.js';
import type { ThemeProfileRepositoryContract } from './theme-profile.types.js';

interface ThemeProfileMaterializationDependencies {
  sourceRepository: ThemeProfileRepositoryContract;
  materializedRepository: MaterializedThemeProfileRepositoryContract;
  clock?: () => Date;
}

type VersionableProfile = Omit<MaterializedThemeProfileInput, 'dataVersion'>;

export function createThemeProfileDataVersion(
  profile: VersionableProfile,
): string {
  return createHash('sha256').update(JSON.stringify(profile)).digest('hex');
}

export class ThemeProfileMaterializationService {
  private readonly clock: () => Date;

  constructor(
    private readonly dependencies: ThemeProfileMaterializationDependencies,
  ) {
    this.clock = dependencies.clock ?? (() => new Date());
  }

  async run(
    options: ThemeProfileMaterializationOptions,
  ): Promise<ThemeProfileMaterializationSummary> {
    const started = performance.now();
    validateThemePeriod({
      startYear: options.startYear,
      endYear: options.endYear,
    });
    const period = {
      startYear: options.startYear,
      endYear: options.endYear,
    };
    const [parliamentarians, aggregation] = await Promise.all([
      this.dependencies.sourceRepository.listDeputies(),
      this.dependencies.sourceRepository.aggregateProfiles({
        ...period,
        themeSource: options.themeSource,
      }),
    ]);
    const modelVersions =
      options.themeSource === 'enriched'
        ? [
            ...new Set(
              aggregation.summaries.flatMap(
                (summary) => summary.modelVersions ?? [],
              ),
            ),
          ].sort()
        : [];
    const inputs = parliamentarians.map((parliamentarian) => {
      const profile = buildComparableThemeProfile(
        parliamentarian,
        period,
        aggregation,
        options.themeSource,
      );
      const profileModelVersions =
        options.themeSource === 'enriched'
          ? [
              ...(aggregation.summaries.find(
                ({ parliamentarianId }) =>
                  parliamentarianId === parliamentarian.id,
              )?.modelVersions ?? []),
            ].sort()
          : [];
      const input: VersionableProfile = {
        source: 'CAMARA',
        parliamentarianExternalId: parliamentarian.id,
        periodStartYear: options.startYear,
        periodEndYear: options.endYear,
        themeSource: options.themeSource,
        documentsAnalyzed: profile.documentsAnalyzed,
        documentsWithThemes: profile.documentsWithThemes,
        documentsWithOfficialThemes: profile.documentsWithOfficialThemes,
        documentsWithMLThemes: profile.documentsWithMLThemes,
        documentsWithoutThemes: profile.documentsWithoutThemes,
        coverage: profile.coverage,
        officialCoverage: profile.officialCoverage,
        enrichedCoverage: profile.enrichedCoverage,
        totalThemeOccurrences: profile.themes.reduce(
          (sum, theme) => sum + theme.documentCount,
          0,
        ),
        themes: profile.themes,
        ...(profileModelVersions.length === 1
          ? { modelVersion: profileModelVersions[0] }
          : {}),
        modelVersions: profileModelVersions,
      };
      return { ...input, dataVersion: createThemeProfileDataVersion(input) };
    });
    const writeResult =
      await this.dependencies.materializedRepository.replaceScope(
        options,
        inputs,
        {
          dryRun: options.dryRun,
          batchSize: options.batchSize,
          generatedAt: this.clock(),
        },
      );

    return {
      source: 'CAMARA',
      period,
      themeSource: options.themeSource,
      dryRun: options.dryRun,
      status: 'SUCCESS',
      candidates: parliamentarians.length,
      profiles: inputs.length,
      withoutData: inputs.filter(({ themes }) => themes.length === 0).length,
      modelVersions,
      ...writeResult,
      durationMs: performance.now() - started,
    };
  }
}
