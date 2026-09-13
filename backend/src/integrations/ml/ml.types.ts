import type { z } from 'zod';

import type { mlHealthSchema, mlPredictionSchema } from './ml.schemas.js';

export type MLHealth = z.infer<typeof mlHealthSchema>;
export type MLPrediction = z.infer<typeof mlPredictionSchema>;

export interface MLGateway {
  health(): Promise<MLHealth>;
  predict(text: string): Promise<MLPrediction>;
}
