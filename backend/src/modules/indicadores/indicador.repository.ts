import type { AnyBulkWriteOperation, Model } from 'mongoose';

import {
  ParticipacaoOrgaoModel,
  type ParticipacaoOrgaoPersistence,
  VotacaoModel,
  type VotacaoPersistence,
  VotoModel,
  type VotoPersistence,
} from './indicador.model.js';
import type {
  ClassifiedIndicador,
  IndicadorWriteResult,
  ParticipacaoOrgaoInput,
  ParticipacaoOrgaoRecord,
  ParticipacaoOrgaoRepositoryContract,
  VotacaoInput,
  VotacaoRecord,
  VotacaoRepositoryContract,
  VotoInput,
  VotoRecord,
  VotoRepositoryContract,
} from './indicador.types.js';

function normalizedString(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function sameDate(
  left: Date | null | undefined,
  right: Date | null | undefined,
) {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null);
}

function result(classified: Array<{ state: string }>): IndicadorWriteResult {
  return {
    inserted: classified.filter(({ state }) => state === 'INSERTED').length,
    updated: classified.filter(({ state }) => state === 'UPDATED').length,
    unchanged: classified.filter(({ state }) => state === 'UNCHANGED').length,
  };
}

export function classifyVotacoes(
  items: VotacaoInput[],
  existingItems: VotacaoRecord[],
): Array<ClassifiedIndicador<VotacaoInput>> {
  const existing = new Map(
    existingItems.map((item) => [`${item.source}:${item.externalId}`, item]),
  );
  return items.map((item) => {
    const key = `${item.source}:${item.externalId}`;
    const previous = existing.get(key);
    const changed =
      previous !== undefined &&
      (!sameDate(item.data, previous.data) ||
        normalizedString(item.descricao) !==
          normalizedString(previous.descricao) ||
        normalizedString(item.resultado) !==
          normalizedString(previous.resultado) ||
        normalizedString(item.casa) !== normalizedString(previous.casa) ||
        (item.proposicaoExternalId ?? null) !==
          (previous.proposicaoExternalId ?? null));
    existing.set(key, {
      ...item,
      descricao: item.descricao ?? null,
      resultado: item.resultado ?? null,
      proposicaoExternalId: item.proposicaoExternalId ?? null,
    });
    return {
      item,
      state: !previous ? 'INSERTED' : changed ? 'UPDATED' : 'UNCHANGED',
    };
  });
}

export function classifyVotos(
  items: VotoInput[],
  existingItems: VotoRecord[],
): Array<ClassifiedIndicador<VotoInput>> {
  const existing = new Map(
    existingItems.map((item) => [
      `${item.source}:${item.votacaoExternalId}:${item.parlamentarExternalId}`,
      item,
    ]),
  );
  return items.map((item) => {
    const key = `${item.source}:${item.votacaoExternalId}:${item.parlamentarExternalId}`;
    const previous = existing.get(key);
    const changed =
      previous !== undefined &&
      (normalizedString(item.voto) !== normalizedString(previous.voto) ||
        !sameDate(item.data, previous.data));
    existing.set(key, item);
    return {
      item,
      state: !previous ? 'INSERTED' : changed ? 'UPDATED' : 'UNCHANGED',
    };
  });
}

function participationKey(item: ParticipacaoOrgaoInput): string {
  return [
    item.source,
    item.parlamentarExternalId,
    item.orgaoExternalId,
    normalizedString(item.funcao),
    item.inicio?.getTime() ?? null,
  ].join(':');
}

export function classifyParticipacoesOrgaos(
  items: ParticipacaoOrgaoInput[],
  existingItems: ParticipacaoOrgaoRecord[],
): Array<ClassifiedIndicador<ParticipacaoOrgaoInput>> {
  const existing = new Map(
    existingItems.map((item) => [participationKey(item), item]),
  );
  return items.map((item) => {
    const key = participationKey(item);
    const previous = existing.get(key);
    const changed =
      previous !== undefined &&
      (normalizedString(item.sigla) !== normalizedString(previous.sigla) ||
        normalizedString(item.nome) !== normalizedString(previous.nome) ||
        normalizedString(item.casa) !== normalizedString(previous.casa) ||
        !sameDate(item.fim, previous.fim));
    existing.set(key, {
      ...item,
      funcao: item.funcao ?? null,
      inicio: item.inicio ?? null,
      fim: item.fim ?? null,
    });
    return {
      item,
      state: !previous ? 'INSERTED' : changed ? 'UPDATED' : 'UNCHANGED',
    };
  });
}

function operations<T extends { fetchedAt: Date }>(
  classified: Array<ClassifiedIndicador<T>>,
  identity: (item: T) => Record<string, unknown>,
): unknown[] {
  return classified.map(({ item, state }) => ({
    updateOne: {
      filter: identity(item),
      update:
        state === 'UNCHANGED'
          ? { $set: { fetchedAt: item.fetchedAt } }
          : { $set: item },
      upsert: state !== 'UNCHANGED',
      ...(state === 'UNCHANGED' ? { timestamps: false } : {}),
    },
  }));
}

export class VotacaoRepository implements VotacaoRepositoryContract {
  constructor(
    private readonly model: Model<VotacaoPersistence> = VotacaoModel,
  ) {}

  async upsertMany(items: VotacaoInput[]): Promise<IndicadorWriteResult> {
    if (items.length === 0) return { inserted: 0, updated: 0, unchanged: 0 };
    const identities = items.map(({ source, externalId }) => ({
      source,
      externalId,
    }));
    const documents = await this.model.find({ $or: identities }).lean().exec();
    const classified = classifyVotacoes(items, documents);
    await this.model.bulkWrite(
      operations(classified, ({ source, externalId }) => ({
        source,
        externalId,
      })) as Array<AnyBulkWriteOperation<VotacaoPersistence>>,
      { ordered: false },
    );
    return result(classified);
  }
}

export class VotoRepository implements VotoRepositoryContract {
  constructor(private readonly model: Model<VotoPersistence> = VotoModel) {}

  async upsertMany(items: VotoInput[]): Promise<IndicadorWriteResult> {
    if (items.length === 0) return { inserted: 0, updated: 0, unchanged: 0 };
    const identities = items.map(
      ({ source, votacaoExternalId, parlamentarExternalId }) => ({
        source,
        votacaoExternalId,
        parlamentarExternalId,
      }),
    );
    const documents = await this.model.find({ $or: identities }).lean().exec();
    const classified = classifyVotos(items, documents);
    await this.model.bulkWrite(
      operations(
        classified,
        ({ source, votacaoExternalId, parlamentarExternalId }) => ({
          source,
          votacaoExternalId,
          parlamentarExternalId,
        }),
      ) as Array<AnyBulkWriteOperation<VotoPersistence>>,
      { ordered: false },
    );
    return result(classified);
  }
}

export class ParticipacaoOrgaoRepository implements ParticipacaoOrgaoRepositoryContract {
  constructor(
    private readonly model: Model<ParticipacaoOrgaoPersistence> = ParticipacaoOrgaoModel,
  ) {}

  async upsertMany(
    items: ParticipacaoOrgaoInput[],
  ): Promise<IndicadorWriteResult> {
    if (items.length === 0) return { inserted: 0, updated: 0, unchanged: 0 };
    const identity = (item: ParticipacaoOrgaoInput) => ({
      source: item.source,
      parlamentarExternalId: item.parlamentarExternalId,
      orgaoExternalId: item.orgaoExternalId,
      funcao: item.funcao ?? null,
      inicio: item.inicio ?? null,
    });
    const identities = items.map(identity);
    const documents = await this.model.find({ $or: identities }).lean().exec();
    const classified = classifyParticipacoesOrgaos(items, documents);
    await this.model.bulkWrite(
      operations(classified, identity) as Array<
        AnyBulkWriteOperation<ParticipacaoOrgaoPersistence>
      >,
      { ordered: false },
    );
    return result(classified);
  }
}
