import { getCamaraTheme } from '../temas/camara-temas.catalog.js';
import { CompatibilityInvalidPreferencesError } from './compatibility.errors.js';
import { calculateCosineSimilarity } from './compatibility-formulas.js';
import type {
  CompatibilityRequest,
  CompatibilityResponse,
  CompatibilityResult,
  CompatibilityServiceContract,
  ThemePreference,
} from './compatibility.types.js';
import {
  DEFAULT_THEME_PERIOD,
  validateThemePeriod,
} from './theme-profile.service.js';
import type { ThemeProfilesProvider } from './theme-profile.types.js';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const MAX_PREFERENCES = 10;

function validatePreferences(
  source: unknown,
  preferences: ThemePreference[],
  limit: number,
): void {
  const uniqueCodes = new Set(preferences.map(({ themeCode }) => themeCode));
  if (
    source !== 'CAMARA' ||
    preferences.length === 0 ||
    preferences.length > MAX_PREFERENCES ||
    uniqueCodes.size !== preferences.length ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_LIMIT ||
    preferences.some(
      ({ themeCode, weight }) =>
        !Number.isInteger(themeCode) ||
        !getCamaraTheme(themeCode) ||
        !Number.isInteger(weight) ||
        weight < 1 ||
        weight > 5,
    )
  ) {
    throw new CompatibilityInvalidPreferencesError();
  }
}

function roundPercent(value: number): number {
  return Math.round(value * 10_000) / 100;
}

export class CompatibilityService implements CompatibilityServiceContract {
  constructor(private readonly profileProvider: ThemeProfilesProvider) {}

  async rank(request: CompatibilityRequest): Promise<CompatibilityResponse> {
    const period = request.period ?? DEFAULT_THEME_PERIOD;
    const themeSource = request.themeSource ?? 'official';
    const limit = request.limit ?? DEFAULT_LIMIT;
    validatePreferences(request.source, request.preferences, limit);
    validateThemePeriod(period);

    const preferences = [...request.preferences].sort(
      (left, right) =>
        right.weight - left.weight || left.themeCode - right.themeCode,
    );
    const profileData = await this.profileProvider.getComparableProfiles(
      period,
      themeSource,
    );
    const preferenceOrder = new Map(
      preferences.map(({ themeCode }, index) => [themeCode, index]),
    );

    const rankedWithoutEvidence = profileData.profiles
      .map<CompatibilityResult>((profile) => {
        const compatibility = calculateCosineSimilarity(
          preferences,
          profile.themes,
        );
        const shareByCode = new Map(
          profile.themes.map(({ code, share }) => [code, share]),
        );

        return {
          position: 0,
          parliamentarian: profile.parliamentarian,
          compatibility,
          compatibilityPercent: roundPercent(compatibility),
          documentsAnalyzed: profile.documentsAnalyzed,
          coverage: profile.coverage,
          matchedThemes: preferences.map(({ themeCode, weight }) => ({
            code: themeCode,
            name: getCamaraTheme(themeCode)!.name,
            userWeight: weight,
            parliamentarianShare: shareByCode.get(themeCode) ?? 0,
          })),
          evidence: [],
        };
      })
      .sort(
        (left, right) =>
          right.compatibility - left.compatibility ||
          right.coverage - left.coverage ||
          left.parliamentarian.id - right.parliamentarian.id,
      )
      .slice(0, limit)
      .map((result, index) => ({ ...result, position: index + 1 }));
    const evidence = await this.profileProvider.getEvidence(
      period,
      rankedWithoutEvidence.map(({ parliamentarian }) => parliamentarian.id),
      preferences.map(({ themeCode }) => themeCode),
      themeSource,
    );
    const ranked = rankedWithoutEvidence.map((result) => ({
      ...result,
      evidence: evidence
        .filter(
          ({ parliamentarianId }) =>
            parliamentarianId === result.parliamentarian.id,
        )
        .sort(
          (left, right) =>
            preferenceOrder.get(left.themeCode)! -
              preferenceOrder.get(right.themeCode)! ||
            left.proposalId - right.proposalId,
        )
        .slice(0, 3)
        .map((item) => ({
          proposalId: item.proposalId,
          themeCode: item.themeCode,
          title: item.title,
          source: item.source,
          themeOrigin: item.themeOrigin,
          ...(item.decisionScore === undefined
            ? {}
            : { decisionScore: item.decisionScore }),
          ...(item.modelName === undefined
            ? {}
            : { modelName: item.modelName }),
          ...(item.modelVersion === undefined
            ? {}
            : { modelVersion: item.modelVersion }),
        })),
    }));

    return {
      source: 'CAMARA',
      period,
      themeSource,
      method: 'cosine_similarity',
      results: ranked,
      summary: {
        parliamentariansConsidered: profileData.parliamentariansConsidered,
        profilesCompared: profileData.profilesCompared,
        profilesExcludedWithoutThemes:
          profileData.profilesExcludedWithoutThemes,
        documentsAnalyzed: profileData.documentsAnalyzed,
        documentsWithThemes: profileData.documentsWithThemes,
        documentsWithOfficialThemes: profileData.documentsWithOfficialThemes,
        documentsWithMLThemes: profileData.documentsWithMLThemes,
        coverage: profileData.coverage,
        officialCoverage: profileData.officialCoverage,
        enrichedCoverage: profileData.enrichedCoverage,
        themesObserved: profileData.themesObserved,
      },
    };
  }
}
