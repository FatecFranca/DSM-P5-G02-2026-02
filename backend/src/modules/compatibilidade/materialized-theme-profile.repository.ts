import type { AnyBulkWriteOperation, Model } from 'mongoose';

import { MaterializedThemeProfileModel } from './materialized-theme-profile.model.js';
import type {
  MaterializedThemeProfileInput,
  MaterializedThemeProfilePersistence,
  MaterializedThemeProfileRepositoryContract,
  MaterializedThemeProfileScope,
  MaterializedThemeProfileWriteResult,
  ReplaceMaterializedProfileOptions,
} from './materialized-theme-profile.types.js';

function scopeFilter(scope: MaterializedThemeProfileScope) {
  return {
    source: scope.source,
    periodStartYear: scope.startYear,
    periodEndYear: scope.endYear,
    themeSource: scope.themeSource,
  };
}

function identityFilter(profile: MaterializedThemeProfileInput) {
  return {
    source: profile.source,
    parliamentarianExternalId: profile.parliamentarianExternalId,
    periodStartYear: profile.periodStartYear,
    periodEndYear: profile.periodEndYear,
    themeSource: profile.themeSource,
  };
}

export class MaterializedThemeProfileRepository implements MaterializedThemeProfileRepositoryContract {
  constructor(
    private readonly model: Model<MaterializedThemeProfilePersistence> = MaterializedThemeProfileModel,
  ) {}

  async findProfile(
    scope: MaterializedThemeProfileScope,
    parliamentarianExternalId: number,
  ): Promise<MaterializedThemeProfilePersistence | null> {
    return this.model
      .findOne({
        ...scopeFilter(scope),
        parliamentarianExternalId,
      })
      .lean()
      .exec();
  }

  async listProfiles(
    scope: MaterializedThemeProfileScope,
  ): Promise<MaterializedThemeProfilePersistence[]> {
    return this.model
      .find(scopeFilter(scope))
      .sort({ parliamentarianExternalId: 1 })
      .lean()
      .exec();
  }

  async countProfiles(scope: MaterializedThemeProfileScope): Promise<number> {
    return this.model.countDocuments(scopeFilter(scope)).exec();
  }

  async replaceScope(
    scope: MaterializedThemeProfileScope,
    profiles: MaterializedThemeProfileInput[],
    options: ReplaceMaterializedProfileOptions,
  ): Promise<MaterializedThemeProfileWriteResult> {
    const existing = await this.listProfiles(scope);
    const existingById = new Map(
      existing.map((profile) => [profile.parliamentarianExternalId, profile]),
    );
    const profileIds = new Set(
      profiles.map(
        ({ parliamentarianExternalId }) => parliamentarianExternalId,
      ),
    );
    const inserted = profiles.filter(
      ({ parliamentarianExternalId }) =>
        !existingById.has(parliamentarianExternalId),
    );
    const updated = profiles.filter((profile) => {
      const previous = existingById.get(profile.parliamentarianExternalId);
      return (
        previous !== undefined && previous.dataVersion !== profile.dataVersion
      );
    });
    const unchanged = profiles.length - inserted.length - updated.length;
    const deleted = existing.filter(
      ({ parliamentarianExternalId }) =>
        !profileIds.has(parliamentarianExternalId),
    );

    if (!options.dryRun) {
      const operations: AnyBulkWriteOperation<MaterializedThemeProfilePersistence>[] =
        [...updated, ...inserted].map((profile) => ({
          updateOne: {
            filter: identityFilter(profile),
            update: { $set: { ...profile, generatedAt: options.generatedAt } },
            upsert: true,
          },
        }));
      operations.push(
        ...deleted.map((profile) => ({
          deleteOne: { filter: identityFilter(profile) },
        })),
      );
      for (
        let index = 0;
        index < operations.length;
        index += options.batchSize
      ) {
        await this.model.bulkWrite(
          operations.slice(index, index + options.batchSize),
        );
      }
    }

    return {
      inserted: inserted.length,
      updated: updated.length,
      unchanged,
      deleted: deleted.length,
    };
  }
}
