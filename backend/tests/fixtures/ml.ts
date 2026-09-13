export const mlHealthFixture = {
  status: 'ok' as const,
  modelLoaded: true as const,
  modelName: 'linear_svc_balanced',
  modelVersion: 'experimental-1',
  classes: 32,
};

export const mlPredictionFixture = {
  labels: [
    {
      code: '56',
      name: 'Saúde',
      decisionScore: 2.3634,
    },
    {
      code: '44',
      name: 'Direitos Humanos e Minorias',
      decisionScore: 0.418,
    },
  ],
  labelCount: 2,
  model: {
    name: 'linear_svc_balanced',
    version: 'experimental-1',
    source: 'CAMARA' as const,
    years: [2023, 2024, 2025],
  },
};
