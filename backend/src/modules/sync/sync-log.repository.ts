import { SyncLogModel } from './sync-log.model.js';
import type {
  FinishSyncLogInput,
  StartSyncLogInput,
  SyncLogRepositoryContract,
} from './sync.types.js';

export class SyncLogRepository implements SyncLogRepositoryContract {
  async start(input: StartSyncLogInput): Promise<{ id: string }> {
    const log = await SyncLogModel.create({
      ...input,
      status: 'RUNNING',
      processed: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      errors: [],
    });

    return { id: log._id.toString() };
  }

  async finish(id: string, input: FinishSyncLogInput): Promise<void> {
    await SyncLogModel.updateOne({ _id: id }, { $set: input }).exec();
  }
}
