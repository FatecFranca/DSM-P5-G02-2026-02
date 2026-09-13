import type { AnyBulkWriteOperation, Model } from 'mongoose';

import {
  ProposicaoModel,
  type ProposicaoPersistence,
} from './proposicao.model.js';
import type {
  ClassifiedProposicao,
  ProposicaoInput,
  ProposicaoListQuery,
  ProposicaoRecord,
  ProposicaoRepositoryContract,
  ProposicaoSource,
  ProposicaoWriteResult,
} from './proposicao.types.js';

function normalizeString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function canonicalAuthors(value: ProposicaoInput['autores']): string {
  return JSON.stringify(
    value
      .map((author) => ({
        externalId: author.externalId ?? null,
        nome: normalizeString(author.nome),
        tipo: normalizeString(author.tipo),
        uri: normalizeString(author.uri),
        parlamentarExternalId: author.parlamentarExternalId ?? null,
      }))
      .sort(
        (left, right) =>
          (left.externalId ?? Number.MAX_SAFE_INTEGER) -
            (right.externalId ?? Number.MAX_SAFE_INTEGER) ||
          (left.nome ?? '').localeCompare(right.nome ?? '', 'pt-BR') ||
          (left.tipo ?? '').localeCompare(right.tipo ?? '', 'pt-BR') ||
          (left.uri ?? '').localeCompare(right.uri ?? '', 'pt-BR') ||
          (left.parlamentarExternalId ?? Number.MAX_SAFE_INTEGER) -
            (right.parlamentarExternalId ?? Number.MAX_SAFE_INTEGER),
      ),
  );
}

function canonicalThemes(value: ProposicaoInput['temasOficiais']): string {
  return JSON.stringify(
    value
      .map((theme) => ({
        codTema: theme.codTema,
        tema: normalizeString(theme.tema),
      }))
      .sort(
        (left, right) =>
          left.codTema - right.codTema ||
          (left.tema ?? '').localeCompare(right.tema ?? '', 'pt-BR'),
      ),
  );
}

function hasRelevantChanges(
  item: ProposicaoInput,
  existing: ProposicaoRecord,
): boolean {
  return (
    item.tipo.trim() !== existing.tipo.trim() ||
    item.numero !== existing.numero ||
    item.ano !== existing.ano ||
    normalizeString(item.ementa) !== normalizeString(existing.ementa) ||
    normalizeString(item.descricao) !== normalizeString(existing.descricao) ||
    (item.dataApresentacao?.getTime() ?? null) !==
      (existing.dataApresentacao?.getTime() ?? null) ||
    normalizeString(item.situacao) !== normalizeString(existing.situacao) ||
    item.uri !== existing.uri ||
    normalizeString(item.urlFonte) !== normalizeString(existing.urlFonte) ||
    canonicalAuthors(item.autores) !== canonicalAuthors(existing.autores) ||
    canonicalThemes(item.temasOficiais) !==
      canonicalThemes(existing.temasOficiais)
  );
}

export function classifyProposicoes(
  items: ProposicaoInput[],
  existingItems: ProposicaoRecord[],
): ClassifiedProposicao[] {
  const existingById = new Map(
    existingItems.map((item) => [`${item.source}:${item.externalId}`, item]),
  );

  return items.map((item) => {
    const key = `${item.source}:${item.externalId}`;
    const existing = existingById.get(key);
    const state = !existing
      ? 'INSERTED'
      : hasRelevantChanges(item, existing)
        ? 'UPDATED'
        : 'UNCHANGED';
    existingById.set(key, {
      ...item,
      descricao: item.descricao ?? null,
      situacao: item.situacao ?? null,
    });
    return { state, item };
  });
}

export function buildProposicaoUpsertOperations(
  items: ClassifiedProposicao[],
): Array<AnyBulkWriteOperation<ProposicaoPersistence>> {
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

function toRecord(document: ProposicaoPersistence): ProposicaoRecord {
  return {
    externalId: document.externalId,
    source: document.source,
    tipo: document.tipo,
    numero: document.numero,
    ano: document.ano,
    ementa: document.ementa ?? null,
    descricao: document.descricao ?? null,
    dataApresentacao: document.dataApresentacao ?? null,
    situacao: document.situacao ?? null,
    uri: document.uri,
    urlFonte: document.urlFonte ?? null,
    autores: document.autores,
    temasOficiais: document.temasOficiais,
    fetchedAt: document.fetchedAt,
  };
}

export class ProposicaoRepository implements ProposicaoRepositoryContract {
  constructor(
    private readonly model: Model<ProposicaoPersistence> = ProposicaoModel,
  ) {}

  async upsertMany(items: ProposicaoInput[]): Promise<ProposicaoWriteResult> {
    if (items.length === 0) {
      return { inserted: 0, updated: 0, unchanged: 0 };
    }

    const identities = items.map(({ source, externalId }) => ({
      source,
      externalId,
    }));
    const documents = await this.model.find({ $or: identities }).lean().exec();
    const classified = classifyProposicoes(
      items,
      documents.map((document) => toRecord(document)),
    );
    await this.model.bulkWrite(buildProposicaoUpsertOperations(classified), {
      ordered: false,
    });

    return {
      inserted: classified.filter(({ state }) => state === 'INSERTED').length,
      updated: classified.filter(({ state }) => state === 'UPDATED').length,
      unchanged: classified.filter(({ state }) => state === 'UNCHANGED').length,
    };
  }

  async list(
    query: ProposicaoListQuery,
  ): Promise<{ data: ProposicaoRecord[]; total: number }> {
    const filter: {
      source: ProposicaoSource;
      ano?: number;
      tipo?: string;
      'autores.parlamentarExternalId'?: number;
    } = { source: query.source };
    if (query.ano !== undefined) filter.ano = query.ano;
    if (query.tipo !== undefined) filter.tipo = query.tipo;
    if (query.parlamentarExternalId !== undefined) {
      filter['autores.parlamentarExternalId'] = query.parlamentarExternalId;
    }

    const [documents, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ dataApresentacao: -1, externalId: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return { data: documents.map((document) => toRecord(document)), total };
  }

  async findByExternalId(identity: {
    source: ProposicaoSource;
    externalId: number;
  }): Promise<ProposicaoRecord | null> {
    const document = await this.model.findOne(identity).lean().exec();
    return document ? toRecord(document) : null;
  }
}
