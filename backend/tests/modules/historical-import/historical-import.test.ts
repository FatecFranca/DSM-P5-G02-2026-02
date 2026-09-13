import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  parseHistoricalAuthorRow,
  parseHistoricalPropositionRow,
  streamCsvRows,
} from '../../../src/modules/historical-import/historical-csv.js';
import { HistoricalImportService } from '../../../src/modules/historical-import/historical-import.service.js';
import { parseHistoricalImportArgs } from '../../../src/modules/historical-import/historical-import.cli.js';
import { classifyProposicoes } from '../../../src/modules/proposicoes/proposicao.repository.js';
import type {
  ProposicaoInput,
  ProposicaoRecord,
  ProposicaoRepositoryContract,
} from '../../../src/modules/proposicoes/proposicao.types.js';
import type {
  FinishSyncLogInput,
  StartSyncLogInput,
  SyncLogRepositoryContract,
} from '../../../src/modules/sync/sync.types.js';

const dataDir = resolve(process.cwd(), 'tests/fixtures/historical/camara');
const fetchedAt = new Date('2026-09-10T12:00:00.000Z');

class InMemoryPropositionRepository implements ProposicaoRepositoryContract {
  readonly records = new Map<number, ProposicaoRecord>();
  readonly batchSizes: number[] = [];

  upsertMany(items: ProposicaoInput[]) {
    this.batchSizes.push(items.length);
    const classified = classifyProposicoes(items, [...this.records.values()]);
    for (const item of items) {
      this.records.set(item.externalId, {
        ...item,
        descricao: item.descricao ?? null,
        situacao: item.situacao ?? null,
      });
    }
    return Promise.resolve({
      inserted: classified.filter(({ state }) => state === 'INSERTED').length,
      updated: classified.filter(({ state }) => state === 'UPDATED').length,
      unchanged: classified.filter(({ state }) => state === 'UNCHANGED').length,
    });
  }

  list() {
    return Promise.resolve({ data: [...this.records.values()], total: 0 });
  }

  findByExternalId() {
    return Promise.resolve(null);
  }
}

class InMemorySyncLogs implements SyncLogRepositoryContract {
  readonly started: StartSyncLogInput[] = [];
  readonly finished: FinishSyncLogInput[] = [];

  start(input: StartSyncLogInput) {
    this.started.push(input);
    return Promise.resolve({ id: `sync-${this.started.length}` });
  }

  finish(_id: string, input: FinishSyncLogInput) {
    this.finished.push(input);
    return Promise.resolve();
  }
}

function service(
  repository: ProposicaoRepositoryContract,
  logs = new InMemorySyncLogs(),
) {
  return {
    logs,
    subject: new HistoricalImportService({
      propositionRepository: repository,
      syncLogs: logs,
      listKnownDeputyIds: () => Promise.resolve(new Set([101, 102])),
      clock: () => fetchedAt,
    }),
  };
}

describe('CSV histórico da Câmara', () => {
  it('processa o arquivo por async iterator sem carregar o arquivo inteiro', async () => {
    const rows = streamCsvRows(
      resolve(dataDir, 'autores/proposicoesAutores-2023.csv'),
    );

    const first = await rows.next();
    await rows.return(undefined);

    expect(first.value).toMatchObject({
      line: 2,
      values: { idProposicao: '1001', idDeputadoAutor: '101' },
    });
  });

  it('resolve deputado por ID oficial e não vincula autor institucional', () => {
    const deputy = parseHistoricalAuthorRow(
      {
        idProposicao: '1001',
        uriProposicao:
          'https://dadosabertos.camara.leg.br/api/v2/proposicoes/1001',
        idDeputadoAutor: '101',
        uriAutor: 'https://dadosabertos.camara.leg.br/api/v2/deputados/101',
        codTipoAutor: '10000',
        tipoAutor: 'Deputado(a)',
        nomeAutor: 'Deputado Um',
        siglaPartidoAutor: 'AAA',
        uriPartidoAutor: '',
        siglaUFAutor: 'SP',
        ordemAssinatura: '1',
        proponente: '1',
      },
      2,
    );
    const institution = parseHistoricalAuthorRow(
      {
        idProposicao: '1002',
        uriProposicao:
          'https://dadosabertos.camara.leg.br/api/v2/proposicoes/1002',
        idDeputadoAutor: '',
        uriAutor: 'https://dadosabertos.camara.leg.br/api/v2/orgaos/55',
        codTipoAutor: '40000',
        tipoAutor: 'Orgao do Poder Legislativo',
        nomeAutor: 'Comissao Ficticia',
        siglaPartidoAutor: '',
        uriPartidoAutor: '',
        siglaUFAutor: '',
        ordemAssinatura: '1',
        proponente: '1',
      },
      3,
    );

    expect(deputy).toMatchObject({
      propositionId: 1001,
      deputyId: 101,
      author: { externalId: 101 },
      signatureOrder: 1,
      proponent: true,
    });
    expect(institution).toMatchObject({
      propositionId: 1002,
      deputyId: null,
      author: { externalId: 55, parlamentarExternalId: null },
    });
  });

  it('rejeita IDs inválidos e nomes de autor vazios com número da linha', () => {
    expect(() =>
      parseHistoricalAuthorRow(
        {
          idProposicao: 'invalido',
          uriProposicao: '',
          idDeputadoAutor: '',
          uriAutor: '',
          codTipoAutor: '',
          tipoAutor: 'Deputado(a)',
          nomeAutor: '',
          siglaPartidoAutor: '',
          uriPartidoAutor: '',
          siglaUFAutor: '',
          ordemAssinatura: '1',
          proponente: '1',
        },
        9,
      ),
    ).toThrow('Linha 9');
  });

  it('aceita número oficial zero sem descartar a proposição', () => {
    const proposition = parseHistoricalPropositionRow(
      {
        id: '1005',
        uri: 'https://dadosabertos.camara.leg.br/api/v2/proposicoes/1005',
        siglaTipo: 'OF',
        numero: '0',
        ano: '0',
        ementa: 'Oficio sem numero.',
        ementaDetalhada: '',
        dataApresentacao: '2023-09-01T10:53:00',
        urlInteiroTeor: '',
        ultimoStatus_descricaoSituacao: '',
      },
      4,
      fetchedAt,
    );

    expect(proposition.numero).toBe(0);
    expect(proposition.ano).toBe(2023);
  });
});

describe('HistoricalImportService', () => {
  it('faz dry-run completo sem escrever nem criar sync_log', async () => {
    const repository = new InMemoryPropositionRepository();
    const { logs, subject } = service(repository);

    const result = await subject.run({
      startYear: 2023,
      endYear: 2025,
      dataDir,
      dryRun: true,
      batchSize: 2,
    });

    expect(result).toMatchObject({
      dryRun: true,
      propositionsRead: 4,
      propositionsValid: 3,
      themesRead: 2,
      authorsRead: 5,
      parliamentaryAuthorsResolved: 3,
      nonParliamentaryAuthors: 1,
      associations: 3,
      propositionsWithThemes: 2,
      propositionsWithoutThemes: 1,
      propositionsWithDeputy: 2,
      propositionsWithoutDeputy: 1,
      estimatedUpserts: 3,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      errors: [],
    });
    expect(repository.batchSizes).toEqual([]);
    expect(logs.started).toEqual([]);
  });

  it('preserva coautoria, autores não parlamentares e proposições sem tema', async () => {
    const repository = new InMemoryPropositionRepository();
    const { subject } = service(repository);

    await subject.run({
      startYear: 2023,
      endYear: 2025,
      dataDir,
      dryRun: false,
      batchSize: 2,
    });

    expect(repository.records.get(1001)).toMatchObject({
      ano: 2023,
      temasOficiais: [],
      autores: [{ parlamentarExternalId: 101 }, { parlamentarExternalId: 102 }],
    });
    expect(repository.records.get(1002)).toMatchObject({
      ano: 2024,
      autores: [{ nome: 'Comissao Ficticia', parlamentarExternalId: null }],
    });
    expect(repository.records.get(1003)?.autores[0]).toMatchObject({
      parlamentarExternalId: 101,
    });
  });

  it('usa ano efetivo, batches limitados e mantém o documento 2026 intacto', async () => {
    const repository = new InMemoryPropositionRepository();
    const sentinel: ProposicaoRecord = {
      externalId: 1004,
      source: 'CAMARA',
      tipo: 'PL',
      numero: 4,
      ano: 2026,
      ementa: 'Conteudo 2026 preservado',
      descricao: null,
      dataApresentacao: new Date('2026-01-10T10:00:00.000Z'),
      situacao: null,
      uri: 'https://dadosabertos.camara.leg.br/api/v2/proposicoes/1004',
      urlFonte: null,
      autores: [],
      temasOficiais: [],
      fetchedAt,
    };
    repository.records.set(1004, sentinel);
    const { subject } = service(repository);

    await subject.run({
      startYear: 2023,
      endYear: 2025,
      dataDir,
      dryRun: false,
      batchSize: 2,
    });

    expect(repository.batchSizes).toEqual([2, 1]);
    expect(repository.records.get(1002)?.ano).toBe(2024);
    expect(repository.records.get(1004)).toEqual(sentinel);
  });

  it('é idempotente e registra o período no sync_log', async () => {
    const repository = new InMemoryPropositionRepository();
    const { logs, subject } = service(repository);
    const options = {
      startYear: 2023,
      endYear: 2025,
      dataDir,
      dryRun: false,
      batchSize: 2,
    };

    const first = await subject.run(options);
    const second = await subject.run(options);

    expect(first).toMatchObject({ inserted: 3, updated: 0, unchanged: 0 });
    expect(second).toMatchObject({ inserted: 0, updated: 0, unchanged: 3 });
    expect(logs.started[0]).toMatchObject({
      source: 'CAMARA',
      resource: 'HISTORICAL_PROPOSITIONS',
      period: { startYear: 2023, endYear: 2025 },
    });
    expect(logs.finished[1]).toMatchObject({
      status: 'SUCCESS',
      processed: 3,
      inserted: 0,
      updated: 0,
      unchanged: 3,
    });
  });
});

describe('CLI da importação histórica', () => {
  it('valida os argumentos obrigatórios e aceita dry-run', () => {
    expect(
      parseHistoricalImportArgs([
        '--startYear=2023',
        '--endYear',
        '2025',
        '--data-dir',
        dataDir,
        '--dry-run',
      ]),
    ).toEqual({
      startYear: 2023,
      endYear: 2025,
      dataDir,
      dryRun: true,
      batchSize: 500,
    });
  });

  it('rejeita período fora de 2023-2025', () => {
    expect(() =>
      parseHistoricalImportArgs([
        '--startYear=2022',
        '--endYear=2025',
        '--data-dir',
        dataDir,
      ]),
    ).toThrow('2023 a 2025');
  });
});
