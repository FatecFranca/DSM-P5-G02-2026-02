import type { AnyBulkWriteOperation, Model } from 'mongoose';

import {
  ParlamentarModel,
  type ParlamentarPersistence,
} from './parlamentar.model.js';
import type {
  ClassifiedParlamentar,
  ParlamentarInput,
  ParlamentarRecord,
  ParlamentarRepositoryContract,
  ParlamentarSource,
  ParlamentarWriteResult,
} from './parlamentar.types.js';

const comparableFields = [
  'casa',
  'nome',
  'nomeCivil',
  'partido',
  'uf',
  'fotoUrl',
  'email',
  'situacao',
  'legislatura',
] as const satisfies ReadonlyArray<keyof ParlamentarInput>;

function normalizeComparable(value: unknown): string | number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  return value as number;
}

function hasRelevantChanges(
  item: ParlamentarInput,
  existing: ParlamentarRecord,
): boolean {
  return comparableFields.some(
    (field) =>
      Object.hasOwn(item, field) &&
      normalizeComparable(item[field]) !== normalizeComparable(existing[field]),
  );
}

function identityKey(item: {
  source: ParlamentarSource;
  externalId: number;
}): string {
  return `${item.source}:${item.externalId}`;
}

export function classifyParlamentares(
  items: ParlamentarInput[],
  existingItems: ParlamentarRecord[],
): ClassifiedParlamentar[] {
  const existingByIdentity = new Map(
    existingItems.map((item) => [identityKey(item), item]),
  );

  return items.map((item) => {
    const existing = existingByIdentity.get(identityKey(item));
    const state = !existing
      ? 'INSERTED'
      : hasRelevantChanges(item, existing)
        ? 'UPDATED'
        : 'UNCHANGED';

    existingByIdentity.set(identityKey(item), {
      ...existing,
      ...item,
      nomeCivil: item.nomeCivil ?? existing?.nomeCivil ?? null,
      situacao: item.situacao ?? existing?.situacao ?? null,
    });

    return { state, item };
  });
}

export function buildParlamentarUpsertOperations(
  items: ClassifiedParlamentar[],
): Array<AnyBulkWriteOperation<ParlamentarPersistence>> {
  return items.map(({ item, state }) =>
    state === 'UNCHANGED'
      ? {
          updateOne: {
            filter: { source: item.source, externalId: item.externalId },
            update: { $set: { fetchedAt: item.fetchedAt } },
            upsert: false,
            timestamps: false,
          },
        }
      : {
          updateOne: {
            filter: { source: item.source, externalId: item.externalId },
            update: { $set: item },
            upsert: true,
          },
        },
  );
}

function toRecord(document: ParlamentarPersistence): ParlamentarRecord {
  return {
    externalId: document.externalId,
    source: document.source,
    casa: document.casa,
    nome: document.nome,
    nomeCivil: document.nomeCivil ?? null,
    partido: document.partido,
    uf: document.uf,
    fotoUrl: document.fotoUrl,
    email: document.email,
    situacao: document.situacao ?? null,
    legislatura: document.legislatura,
    fetchedAt: document.fetchedAt,
  };
}

export class ParlamentarRepository implements ParlamentarRepositoryContract {
  constructor(
    private readonly model: Model<ParlamentarPersistence> = ParlamentarModel,
  ) {}

  async upsertMany(items: ParlamentarInput[]): Promise<ParlamentarWriteResult> {
    if (items.length === 0) {
      return { inserted: 0, updated: 0, unchanged: 0 };
    }

    const identities = items.map(({ source, externalId }) => ({
      source,
      externalId,
    }));
    const existingDocuments = await this.model
      .find({ $or: identities })
      .lean()
      .exec();
    const classified = classifyParlamentares(
      items,
      existingDocuments.map((document) => toRecord(document)),
    );

    await this.model.bulkWrite(buildParlamentarUpsertOperations(classified), {
      ordered: false,
    });

    return {
      inserted: classified.filter(({ state }) => state === 'INSERTED').length,
      updated: classified.filter(({ state }) => state === 'UPDATED').length,
      unchanged: classified.filter(({ state }) => state === 'UNCHANGED').length,
    };
  }

  async list(query: {
    source: ParlamentarSource;
    page: number;
    limit: number;
  }): Promise<{ data: ParlamentarRecord[]; total: number }> {
    const filter = { source: query.source };
    const skip = (query.page - 1) * query.limit;

    const [documents, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ nome: 1, externalId: 1 })
        .skip(skip)
        .limit(query.limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return {
      data: documents.map((document) => toRecord(document)),
      total,
    };
  }

  async findByExternalId(identity: {
    source: ParlamentarSource;
    externalId: number;
  }): Promise<ParlamentarRecord | null> {
    const document = await this.model.findOne(identity).lean().exec();

    return document ? toRecord(document) : null;
  }
}
