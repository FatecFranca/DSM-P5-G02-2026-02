import { describe, expect, it } from 'vitest';

import { CamaraUnavailableError } from '../../../src/integrations/camara/camara.errors.js';
import {
  camaraDeputadoOrgaosResponseSchema,
  camaraVotacoesResponseSchema,
  camaraVotosResponseSchema,
} from '../../../src/integrations/camara/camara.schemas.js';
import type { CamaraGateway } from '../../../src/integrations/camara/camara.types.js';
import { SenadoUnavailableError } from '../../../src/integrations/senado/senado.errors.js';
import { IndicadorInvalidPeriodError } from '../../../src/modules/indicadores/indicador.errors.js';
import {
  senadoComissoesResponseSchema,
  senadoVotacoesSchema,
} from '../../../src/integrations/senado/senado.schemas.js';
import type { SenadoIndicadoresGateway } from '../../../src/integrations/senado/senado.types.js';
import {
  classifyParticipacoesOrgaos,
  classifyVotacoes,
  classifyVotos,
} from '../../../src/modules/indicadores/indicador.repository.js';
import type {
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
} from '../../../src/modules/indicadores/indicador.types.js';
import type { ParlamentarRepositoryContract } from '../../../src/modules/parlamentares/parlamentar.types.js';
import { CamaraIndicadorSyncService } from '../../../src/modules/sync/camara-indicador-sync.service.js';
import { SenadoIndicadorSyncService } from '../../../src/modules/sync/senado-indicador-sync.service.js';
import type {
  FinishSyncLogInput,
  StartSyncLogInput,
  SyncLogRepositoryContract,
} from '../../../src/modules/sync/sync.types.js';
import {
  camaraOrgaosResponseFixture,
  camaraVotacoesResponseFixture,
  camaraVotosResponseFixture,
  senadoComissoesResponseFixture,
  senadoVotacoesFixture,
} from '../../fixtures/indicadores.js';

class InMemoryVotacoes implements VotacaoRepositoryContract {
  readonly records = new Map<string, VotacaoRecord>();

  upsertMany(items: VotacaoInput[]): Promise<IndicadorWriteResult> {
    const classified = classifyVotacoes(items, [...this.records.values()]);
    for (const item of items) {
      this.records.set(`${item.source}:${item.externalId}`, {
        ...item,
        descricao: item.descricao ?? null,
        resultado: item.resultado ?? null,
        proposicaoExternalId: item.proposicaoExternalId ?? null,
      });
    }
    return Promise.resolve(toResult(classified));
  }
}

class InMemoryVotos implements VotoRepositoryContract {
  readonly records = new Map<string, VotoRecord>();

  upsertMany(items: VotoInput[]): Promise<IndicadorWriteResult> {
    const classified = classifyVotos(items, [...this.records.values()]);
    for (const item of items) {
      this.records.set(
        `${item.source}:${item.votacaoExternalId}:${item.parlamentarExternalId}`,
        item,
      );
    }
    return Promise.resolve(toResult(classified));
  }
}

class InMemoryParticipacoes implements ParticipacaoOrgaoRepositoryContract {
  readonly records = new Map<string, ParticipacaoOrgaoRecord>();

  upsertMany(items: ParticipacaoOrgaoInput[]): Promise<IndicadorWriteResult> {
    const classified = classifyParticipacoesOrgaos(items, [
      ...this.records.values(),
    ]);
    for (const item of items) {
      this.records.set(
        [
          item.source,
          item.parlamentarExternalId,
          item.orgaoExternalId,
          item.funcao ?? null,
          item.inicio?.getTime() ?? null,
        ].join(':'),
        {
          ...item,
          funcao: item.funcao ?? null,
          inicio: item.inicio ?? null,
          fim: item.fim ?? null,
        },
      );
    }
    return Promise.resolve(toResult(classified));
  }
}

function toResult(classified: Array<{ state: string }>): IndicadorWriteResult {
  return {
    inserted: classified.filter(({ state }) => state === 'INSERTED').length,
    updated: classified.filter(({ state }) => state === 'UPDATED').length,
    unchanged: classified.filter(({ state }) => state === 'UNCHANGED').length,
  };
}

class InMemoryLogs implements SyncLogRepositoryContract {
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

function parlamentares(source: 'CAMARA' | 'SENADO' | null) {
  const repository: ParlamentarRepositoryContract = {
    upsertMany: () =>
      Promise.resolve({ inserted: 0, updated: 0, unchanged: 0 }),
    list: () => Promise.resolve({ data: [], total: 0 }),
    findByExternalId: ({ source: requestedSource, externalId }) =>
      Promise.resolve(
        source === requestedSource
          ? {
              source,
              casa: source,
              externalId,
              nome: 'Parlamentar Fictício',
              nomeCivil: null,
              partido: null,
              uf: null,
              fotoUrl: null,
              email: null,
              situacao: null,
              legislatura: null,
              fetchedAt: new Date(),
            }
          : null,
      ),
  };
  return repository;
}

const camaraExternal = {
  votacoes: camaraVotacoesResponseSchema.parse(camaraVotacoesResponseFixture),
  votos: camaraVotosResponseSchema.parse(camaraVotosResponseFixture),
  orgaos: camaraDeputadoOrgaosResponseSchema.parse(camaraOrgaosResponseFixture),
};
const senadoExternal = {
  votacoes: senadoVotacoesSchema.parse(senadoVotacoesFixture),
  comissoes: senadoComissoesResponseSchema.parse(
    senadoComissoesResponseFixture,
  ),
};
const clock = () => new Date('2026-09-07T20:00:00.000Z');

function camaraGateway(): Pick<
  CamaraGateway,
  'listVotacoes' | 'getVotos' | 'listDeputadoOrgaos'
> {
  return {
    listVotacoes: () => Promise.resolve(camaraExternal.votacoes),
    getVotos: () => Promise.resolve(camaraExternal.votos),
    listDeputadoOrgaos: () => Promise.resolve(camaraExternal.orgaos),
  };
}

function senadoGateway(): SenadoIndicadoresGateway {
  return {
    listVotacoes: () => Promise.resolve(senadoExternal.votacoes),
    listSenadorComissoes: () => Promise.resolve(senadoExternal.comissoes),
  };
}

describe('CamaraIndicadorSyncService', () => {
  it('sincroniza somente voto do deputado e órgãos no escopo controlado', async () => {
    const queries: unknown[] = [];
    const gateway = camaraGateway();
    gateway.listVotacoes = (query) => {
      queries.push(query);
      return Promise.resolve(camaraExternal.votacoes);
    };
    gateway.listDeputadoOrgaos = (id, query) => {
      queries.push({ id, ...query });
      return Promise.resolve(camaraExternal.orgaos);
    };
    const logs = new InMemoryLogs();
    const service = new CamaraIndicadorSyncService(
      gateway,
      new InMemoryVotacoes(),
      new InMemoryVotos(),
      new InMemoryParticipacoes(),
      parlamentares('CAMARA'),
      logs,
      clock,
    );

    const result = await service.syncIndicadores({
      parlamentarExternalId: 204_379,
      dataInicio: '2026-06-17',
      dataFim: '2026-06-17',
      orgaoId: 180,
      maxVotacoes: 5,
      maxOrgaos: 5,
    });

    expect(queries).toEqual([
      {
        dataInicio: '2026-06-17',
        dataFim: '2026-06-18',
        orgaoId: 180,
        pagina: 1,
        itens: 5,
      },
      {
        id: 204_379,
        dataInicio: '2026-06-17',
        dataFim: '2026-06-17',
        pagina: 1,
        itens: 5,
      },
    ]);
    expect(result).toEqual({
      source: 'CAMARA',
      resource: 'INDICADORES',
      status: 'SUCCESS',
      processed: 3,
      inserted: 3,
      updated: 0,
      unchanged: 0,
      errors: [],
    });
    expect(logs.started[0]).toMatchObject({
      source: 'CAMARA',
      resource: 'INDICADORES',
    });
  });

  it('é idempotente e detecta mudança no voto oficial', async () => {
    const votacoes = new InMemoryVotacoes();
    const votos = new InMemoryVotos();
    const participacoes = new InMemoryParticipacoes();
    const input = {
      parlamentarExternalId: 204_379,
      dataInicio: '2026-06-17',
      dataFim: '2026-06-17',
      maxVotacoes: 5,
      maxOrgaos: 5,
    };
    const create = (gateway = camaraGateway()) =>
      new CamaraIndicadorSyncService(
        gateway,
        votacoes,
        votos,
        participacoes,
        parlamentares('CAMARA'),
        new InMemoryLogs(),
        clock,
      );

    await create().syncIndicadores(input);
    await expect(create().syncIndicadores(input)).resolves.toMatchObject({
      inserted: 0,
      updated: 0,
      unchanged: 3,
    });
    const changed = camaraGateway();
    changed.getVotos = () =>
      Promise.resolve({
        ...camaraExternal.votos,
        dados: camaraExternal.votos.dados.map((item, index) =>
          index === 0 ? { ...item, tipoVoto: 'Não' } : item,
        ),
      });
    await expect(create(changed).syncIndicadores(input)).resolves.toMatchObject(
      { inserted: 0, updated: 1, unchanged: 2 },
    );
  });

  it('registra PARTIAL e preserva dados quando votos falham', async () => {
    const gateway = camaraGateway();
    gateway.getVotos = () => Promise.reject(new CamaraUnavailableError());
    const logs = new InMemoryLogs();

    const result = await new CamaraIndicadorSyncService(
      gateway,
      new InMemoryVotacoes(),
      new InMemoryVotos(),
      new InMemoryParticipacoes(),
      parlamentares('CAMARA'),
      logs,
      clock,
    ).syncIndicadores({
      parlamentarExternalId: 204_379,
      dataInicio: '2026-06-17',
      dataFim: '2026-06-17',
      maxVotacoes: 5,
      maxOrgaos: 5,
    });

    expect(result).toMatchObject({
      status: 'PARTIAL',
      processed: 1,
      inserted: 1,
    });
    expect(result.errors).toHaveLength(1);
    expect(logs.finished[0]?.status).toBe('PARTIAL');
  });

  it('não persiste voto órfão quando a votação falha no repository', async () => {
    let voteWrites = 0;
    const failingVotacoes: VotacaoRepositoryContract = {
      upsertMany: () => Promise.reject(new Error('Falha de escrita.')),
    };
    const votos: VotoRepositoryContract = {
      upsertMany: () => {
        voteWrites += 1;
        return Promise.resolve({ inserted: 1, updated: 0, unchanged: 0 });
      },
    };

    const result = await new CamaraIndicadorSyncService(
      camaraGateway(),
      failingVotacoes,
      votos,
      new InMemoryParticipacoes(),
      parlamentares('CAMARA'),
      new InMemoryLogs(),
      clock,
    ).syncIndicadores({
      parlamentarExternalId: 204_379,
      dataInicio: '2026-06-17',
      dataFim: '2026-06-17',
      maxVotacoes: 5,
      maxOrgaos: 5,
    });

    expect(result.status).toBe('PARTIAL');
    expect(voteWrites).toBe(0);
  });

  it('registra FAILED quando todas as fontes falham', async () => {
    const gateway = camaraGateway();
    gateway.listVotacoes = () => Promise.reject(new CamaraUnavailableError());
    gateway.listDeputadoOrgaos = () =>
      Promise.reject(new CamaraUnavailableError());
    const logs = new InMemoryLogs();
    const service = new CamaraIndicadorSyncService(
      gateway,
      new InMemoryVotacoes(),
      new InMemoryVotos(),
      new InMemoryParticipacoes(),
      parlamentares('CAMARA'),
      logs,
      clock,
    );

    await expect(
      service.syncIndicadores({
        parlamentarExternalId: 204_379,
        dataInicio: '2026-06-17',
        dataFim: '2026-06-17',
        maxVotacoes: 5,
        maxOrgaos: 5,
      }),
    ).rejects.toBeInstanceOf(CamaraUnavailableError);
    expect(logs.finished[0]?.status).toBe('FAILED');
  });

  it.each([
    ['2026-02-30', '2026-02-30'],
    ['2026-99-99', '2026-06-30'],
    ['2026-07-01', '2026-06-30'],
    ['2026-06-01', '2026-07-02'],
  ])(
    'rejeita período controlado inválido %s a %s',
    async (dataInicio, dataFim) => {
      const logs = new InMemoryLogs();
      const service = new CamaraIndicadorSyncService(
        camaraGateway(),
        new InMemoryVotacoes(),
        new InMemoryVotos(),
        new InMemoryParticipacoes(),
        parlamentares('CAMARA'),
        logs,
        clock,
      );

      await expect(
        service.syncIndicadores({
          parlamentarExternalId: 204_379,
          dataInicio,
          dataFim,
          maxVotacoes: 5,
          maxOrgaos: 5,
        }),
      ).rejects.toBeInstanceOf(IndicadorInvalidPeriodError);
      expect(logs.finished[0]?.status).toBe('FAILED');
    },
  );
});

describe('SenadoIndicadorSyncService', () => {
  it('sincroniza votos nominais e limita comissões atuais', async () => {
    const result = await new SenadoIndicadorSyncService(
      senadoGateway(),
      new InMemoryVotacoes(),
      new InMemoryVotos(),
      new InMemoryParticipacoes(),
      parlamentares('SENADO'),
      new InMemoryLogs(),
      clock,
    ).syncIndicadores({
      parlamentarExternalId: 5672,
      dataInicio: '2026-08-12',
      dataFim: '2026-08-12',
      maxVotacoes: 5,
      maxOrgaos: 1,
    });

    expect(result).toEqual({
      source: 'SENADO',
      resource: 'INDICADORES',
      status: 'SUCCESS',
      processed: 3,
      inserted: 3,
      updated: 0,
      unchanged: 0,
      errors: [],
    });
  });

  it('é idempotente', async () => {
    const votacoes = new InMemoryVotacoes();
    const votos = new InMemoryVotos();
    const participacoes = new InMemoryParticipacoes();
    const service = new SenadoIndicadorSyncService(
      senadoGateway(),
      votacoes,
      votos,
      participacoes,
      parlamentares('SENADO'),
      new InMemoryLogs(),
      clock,
    );
    const input = {
      parlamentarExternalId: 5672,
      dataInicio: '2026-08-12',
      dataFim: '2026-08-12',
      maxVotacoes: 5,
      maxOrgaos: 5,
    };

    await service.syncIndicadores(input);
    await expect(service.syncIndicadores(input)).resolves.toMatchObject({
      inserted: 0,
      updated: 0,
      unchanged: 3,
    });
  });

  it('aplica limites após ordenação determinística da resposta externa', async () => {
    const votacoes = new InMemoryVotacoes();
    const votos = new InMemoryVotos();
    const participacoes = new InMemoryParticipacoes();
    const secondVoting = {
      ...senadoExternal.votacoes[0],
      codigoSessaoVotacao: 7103,
    };
    const secondCommission = {
      ...senadoExternal.comissoes[0],
      IdentificacaoComissao: {
        ...senadoExternal.comissoes[0].IdentificacaoComissao,
        CodigoComissao: 40,
        SiglaComissao: 'CAS',
        NomeComissao: 'Comissão de Assuntos Sociais',
      },
    };
    const create = (reverse: boolean) => {
      const gateway: SenadoIndicadoresGateway = {
        listVotacoes: () =>
          Promise.resolve(
            reverse
              ? [senadoExternal.votacoes[0], secondVoting]
              : [secondVoting, senadoExternal.votacoes[0]],
          ),
        listSenadorComissoes: () =>
          Promise.resolve(
            reverse
              ? [senadoExternal.comissoes[0], secondCommission]
              : [secondCommission, senadoExternal.comissoes[0]],
          ),
      };
      return new SenadoIndicadorSyncService(
        gateway,
        votacoes,
        votos,
        participacoes,
        parlamentares('SENADO'),
        new InMemoryLogs(),
        clock,
      );
    };
    const input = {
      parlamentarExternalId: 5672,
      dataInicio: '2026-08-12',
      dataFim: '2026-08-12',
      maxVotacoes: 1,
      maxOrgaos: 1,
    };

    await create(false).syncIndicadores(input);
    await expect(create(true).syncIndicadores(input)).resolves.toMatchObject({
      inserted: 0,
      updated: 0,
      unchanged: 3,
    });
  });

  it('continua como PARTIAL quando comissões falham', async () => {
    const gateway = senadoGateway();
    gateway.listSenadorComissoes = () =>
      Promise.reject(new SenadoUnavailableError());

    const result = await new SenadoIndicadorSyncService(
      gateway,
      new InMemoryVotacoes(),
      new InMemoryVotos(),
      new InMemoryParticipacoes(),
      parlamentares('SENADO'),
      new InMemoryLogs(),
      clock,
    ).syncIndicadores({
      parlamentarExternalId: 5672,
      dataInicio: '2026-08-12',
      dataFim: '2026-08-12',
      maxVotacoes: 5,
      maxOrgaos: 5,
    });

    expect(result).toMatchObject({
      status: 'PARTIAL',
      processed: 2,
      inserted: 2,
    });
    expect(result.errors).toHaveLength(1);
  });
});
