import type { AnyBulkWriteOperation, Model } from 'mongoose';

import {
  ProposicaoModel,
  type ProposicaoPersistence,
} from '../proposicoes/proposicao.model.js';
import type {
  MlClassificationUpdate,
  MlClassificationWriteResult,
  MlEnrichmentCandidate,
  MlThemeEnrichmentRepositoryContract,
  MlThemeSelectionStats,
} from './ml-theme-enrichment.types.js';

function operationsFor(
  updates: MlClassificationUpdate[],
): Array<AnyBulkWriteOperation<ProposicaoPersistence>> {
  return updates.map(({ externalId, classification }) => ({
    updateOne: {
      filter: {
        source: 'CAMARA',
        externalId,
        'temasOficiais.0': { $exists: false },
      },
      update: { $set: { mlClassification: classification } },
      upsert: false,
    },
  }));
}

export class MlThemeEnrichmentRepository implements MlThemeEnrichmentRepositoryContract {
  constructor(
    private readonly model: Model<ProposicaoPersistence> = ProposicaoModel,
  ) {}

  async countScope(query: {
    startYear: number;
    endYear: number;
  }): Promise<MlThemeSelectionStats> {
    const scope = {
      source: 'CAMARA' as const,
      ano: { $gte: query.startYear, $lte: query.endYear },
    };
    const [propositionsTotal, official] = await Promise.all([
      this.model.countDocuments(scope).exec(),
      this.model
        .countDocuments({ ...scope, 'temasOficiais.0': { $exists: true } })
        .exec(),
    ]);
    return {
      propositionsTotal,
      official,
      uncovered: propositionsTotal - official,
    };
  }

  async listUncoveredPage(query: {
    startYear: number;
    endYear: number;
    afterExternalId?: number;
    limit: number;
  }): Promise<MlEnrichmentCandidate[]> {
    const filter = {
      source: 'CAMARA' as const,
      ano: { $gte: query.startYear, $lte: query.endYear },
      'temasOficiais.0': { $exists: false },
      ...(query.afterExternalId === undefined
        ? {}
        : { externalId: { $gt: query.afterExternalId } }),
    };
    const documents = await this.model
      .find(filter, { externalId: 1, ementa: 1, mlClassification: 1 })
      .sort({ externalId: 1 })
      .limit(query.limit)
      .lean()
      .exec();
    return documents.map((document) => ({
      externalId: document.externalId,
      ementa: document.ementa ?? null,
      mlClassification: document.mlClassification ?? null,
    }));
  }

  async saveClassifications(
    updates: MlClassificationUpdate[],
  ): Promise<MlClassificationWriteResult> {
    const classified = updates.filter(
      ({ classification }) => classification.status === 'CLASSIFIED',
    );
    const noLabel = updates.filter(
      ({ classification }) => classification.status === 'NO_LABEL',
    );
    const classifiedResult =
      classified.length === 0
        ? null
        : await this.model.bulkWrite(operationsFor(classified), {
            ordered: false,
          });
    const noLabelResult =
      noLabel.length === 0
        ? null
        : await this.model.bulkWrite(operationsFor(noLabel), {
            ordered: false,
          });
    const classifiedMatched = classifiedResult?.matchedCount ?? 0;
    const noLabelMatched = noLabelResult?.matchedCount ?? 0;
    return {
      classified: classifiedMatched,
      noLabel: noLabelMatched,
      skippedOfficialRace: updates.length - classifiedMatched - noLabelMatched,
    };
  }
}
