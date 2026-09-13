export interface ThemePreferenceValue {
  themeCode: number;
  weight: number;
}

export interface ThemeShareValue {
  code: number;
  share: number;
}

export function calculateWeightedThematicCoverage(
  preferences: ThemePreferenceValue[],
  themes: ThemeShareValue[],
): number {
  const weightSum = preferences.reduce(
    (sum, preference) => sum + preference.weight,
    0,
  );
  if (weightSum === 0) return 0;

  const shareByCode = new Map(themes.map((theme) => [theme.code, theme.share]));
  return preferences.reduce(
    (score, preference) =>
      score +
      (preference.weight / weightSum) *
        (shareByCode.get(preference.themeCode) ?? 0),
    0,
  );
}

export function calculateCosineSimilarity(
  preferences: ThemePreferenceValue[],
  themes: ThemeShareValue[],
): number {
  const preferenceByCode = new Map(
    preferences.map((preference) => [preference.themeCode, preference.weight]),
  );
  const dotProduct = themes.reduce(
    (sum, theme) => sum + (preferenceByCode.get(theme.code) ?? 0) * theme.share,
    0,
  );
  const preferenceNorm = Math.sqrt(
    preferences.reduce((sum, preference) => sum + preference.weight ** 2, 0),
  );
  const profileNorm = Math.sqrt(
    themes.reduce((sum, theme) => sum + theme.share ** 2, 0),
  );
  if (preferenceNorm === 0 || profileNorm === 0) return 0;

  return Math.min(1, Math.max(0, dotProduct / (preferenceNorm * profileNorm)));
}
