import type { MLGateway } from '../../integrations/ml/ml.types.js';
import type { MLPrediction } from '../../integrations/ml/ml.types.js';
import { MLInvalidTextError } from './ml.errors.js';
import type { MLServiceContract } from './ml.types.js';

export const MAX_ML_TEXT_LENGTH = 5_000;

export class MLService implements MLServiceContract {
  constructor(private readonly gateway: MLGateway) {}

  health() {
    return this.gateway.health();
  }

  async predict(text: string): Promise<MLPrediction> {
    if (!text.trim() || text.length > MAX_ML_TEXT_LENGTH) {
      throw new MLInvalidTextError();
    }
    return await this.gateway.predict(text);
  }
}
