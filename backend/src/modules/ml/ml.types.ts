import type { MLHealth, MLPrediction } from '../../integrations/ml/ml.types.js';

export interface MLServiceContract {
  health(): Promise<MLHealth>;
  predict(text: string): Promise<MLPrediction>;
}
