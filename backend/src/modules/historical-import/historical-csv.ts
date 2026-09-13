import { createReadStream } from 'node:fs';
import { extname } from 'node:path';
import { createGunzip } from 'node:zlib';

import { parse } from 'csv-parse';

import type { ProposicaoInput } from '../proposicoes/proposicao.types.js';
import { getCamaraTheme } from '../temas/camara-temas.catalog.js';
import type {
  HistoricalAuthorRow,
  HistoricalThemeRow,
} from './historical-import.types.js';

export interface CsvRow {
  line: number;
  values: Record<string, string>;
}

export class HistoricalCsvRowError extends Error {
  constructor(line: number, message: string) {
    super(`Linha ${line}: ${message}`);
    this.name = 'HistoricalCsvRowError';
  }
}

function positiveInteger(
  value: string | undefined,
  field: string,
  line: number,
): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new HistoricalCsvRowError(line, `${field} inválido.`);
  }
  return parsed;
}

function optionalPositiveInteger(
  value: string | undefined,
  field: string,
  line: number,
): number | null {
  return value?.trim() ? positiveInteger(value, field, line) : null;
}

function nonNegativeInteger(
  value: string | undefined,
  field: string,
  line: number,
): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new HistoricalCsvRowError(line, `${field} inválido.`);
  }
  return parsed;
}

function requiredString(
  value: string | undefined,
  field: string,
  line: number,
): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new HistoricalCsvRowError(line, `${field} vazio.`);
  }
  return normalized;
}

function externalIdFromUri(uri: string): number | null {
  const match = uri.match(/\/(\d+)\/?$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function propositionIdFromUri(uri: string, line: number): number {
  const id = externalIdFromUri(uri);
  if (!id) {
    throw new HistoricalCsvRowError(line, 'URI da proposição inválida.');
  }
  return id;
}

export async function* streamCsvRows(filePath: string): AsyncGenerator<CsvRow> {
  const file = createReadStream(filePath);
  const input =
    extname(filePath).toLowerCase() === '.gz'
      ? file.pipe(createGunzip())
      : file;
  const parser = input.pipe(
    parse({
      bom: true,
      columns: true,
      delimiter: ';',
      info: true,
      skip_empty_lines: true,
    }),
  );

  for await (const item of parser) {
    const parsed = item as {
      info: { lines: number };
      record: Record<string, string>;
    };
    yield { line: parsed.info.lines, values: parsed.record };
  }
}

export function parseHistoricalPropositionRow(
  values: Record<string, string>,
  line: number,
  fetchedAt: Date,
): ProposicaoInput {
  const externalId = positiveInteger(values['id'], 'id', line);
  const presentation = requiredString(
    values['dataApresentacao'],
    'dataApresentacao',
    line,
  );
  const presentationYear = Number(presentation.slice(0, 4));
  const dataApresentacao = new Date(presentation);
  if (
    !Number.isInteger(presentationYear) ||
    Number.isNaN(dataApresentacao.getTime())
  ) {
    throw new HistoricalCsvRowError(line, 'dataApresentacao inválida.');
  }

  return {
    externalId,
    source: 'CAMARA',
    tipo: requiredString(values['siglaTipo'], 'siglaTipo', line),
    numero: nonNegativeInteger(values['numero'], 'numero', line),
    // The profile period is presentation time, not the proposition label year.
    ano: presentationYear,
    ementa: values['ementa']?.trim() || null,
    descricao: values['ementaDetalhada']?.trim() || null,
    dataApresentacao,
    situacao: values['ultimoStatus_descricaoSituacao']?.trim() || null,
    uri: requiredString(values['uri'], 'uri', line),
    urlFonte: values['urlInteiroTeor']?.trim() || null,
    autores: [],
    temasOficiais: [],
    fetchedAt,
  };
}

export function parseHistoricalThemeRow(
  values: Record<string, string>,
  line: number,
): HistoricalThemeRow {
  const code = positiveInteger(values['codTema'], 'codTema', line);
  const name = requiredString(values['tema'], 'tema', line);
  if (!getCamaraTheme(code)) {
    throw new HistoricalCsvRowError(line, `codTema ${code} não suportado.`);
  }
  return {
    propositionId: propositionIdFromUri(
      requiredString(values['uriProposicao'], 'uriProposicao', line),
      line,
    ),
    code,
    name,
  };
}

export function parseHistoricalAuthorRow(
  values: Record<string, string>,
  line: number,
): HistoricalAuthorRow {
  const propositionId = positiveInteger(
    values['idProposicao'],
    'idProposicao',
    line,
  );
  const uri = values['uriAutor']?.trim() || null;
  const deputyId = optionalPositiveInteger(
    values['idDeputadoAutor'],
    'idDeputadoAutor',
    line,
  );
  const uriId = uri ? externalIdFromUri(uri) : null;
  if (deputyId && uriId && deputyId !== uriId) {
    throw new HistoricalCsvRowError(
      line,
      'idDeputadoAutor diverge da URI oficial.',
    );
  }

  return {
    propositionId,
    deputyId,
    author: {
      externalId: deputyId ?? uriId,
      nome: requiredString(values['nomeAutor'], 'nomeAutor', line),
      tipo: requiredString(values['tipoAutor'], 'tipoAutor', line),
      uri,
      parlamentarExternalId: null,
    },
    signatureOrder: positiveInteger(
      values['ordemAssinatura'],
      'ordemAssinatura',
      line,
    ),
    proponent: values['proponente']?.trim() === '1',
  };
}
