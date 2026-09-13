import { describe, expect, it } from 'vitest';

import {
  camaraDeputadoOrgaosResponseSchema,
  camaraVotacoesResponseSchema,
  camaraVotosResponseSchema,
} from '../../../src/integrations/camara/camara.schemas.js';
import {
  senadoComissoesResponseSchema,
  senadoVotacoesSchema,
} from '../../../src/integrations/senado/senado.schemas.js';
import {
  mapCamaraParticipacaoOrgao,
  mapCamaraVotacao,
  mapCamaraVoto,
} from '../../../src/modules/indicadores/camara-indicador.mapper.js';
import {
  mapSenadoParticipacaoOrgao,
  mapSenadoVotacao,
  mapSenadoVoto,
} from '../../../src/modules/indicadores/senado-indicador.mapper.js';
import {
  camaraOrgaosResponseFixture,
  camaraVotacoesResponseFixture,
  camaraVotosResponseFixture,
  senadoComissoesResponseFixture,
  senadoVotacoesFixture,
} from '../../fixtures/indicadores.js';

const fetchedAt = new Date('2026-09-07T20:00:00.000Z');

describe('mappers de indicadores da Câmara', () => {
  it('normaliza votação sem interpretar o resultado oficial', () => {
    const external = camaraVotacoesResponseSchema.parse(
      camaraVotacoesResponseFixture,
    ).dados[0];

    expect(mapCamaraVotacao(external, fetchedAt)).toEqual({
      source: 'CAMARA',
      externalId: '2633410-8',
      data: new Date('2026-06-17T00:00:00.000Z'),
      descricao: 'Aprovado o Requerimento de Urgência. Sim: 273; Não: 160.',
      resultado: '1',
      casa: 'CAMARA',
      proposicaoExternalId: 2_633_410,
      fetchedAt,
    });
  });

  it('preserva o valor oficial do voto e vínculo parlamentar', () => {
    const external = camaraVotosResponseSchema.parse(camaraVotosResponseFixture)
      .dados[0];

    expect(
      mapCamaraVoto(
        '2633410-8',
        new Date('2026-06-17T00:00:00.000Z'),
        external,
        fetchedAt,
      ),
    ).toEqual({
      source: 'CAMARA',
      votacaoExternalId: '2633410-8',
      parlamentarExternalId: 204_379,
      voto: 'Sim',
      data: new Date('2026-06-17T00:00:00.000Z'),
      fetchedAt,
    });
  });

  it('preserva função e período do órgão sem inferir ativo', () => {
    const external = camaraDeputadoOrgaosResponseSchema.parse(
      camaraOrgaosResponseFixture,
    ).dados[0];

    expect(mapCamaraParticipacaoOrgao(204_379, external, fetchedAt)).toEqual({
      source: 'CAMARA',
      orgaoExternalId: 2003,
      parlamentarExternalId: 204_379,
      sigla: 'CCJC',
      nome: 'Comissão de Constituição e Justiça e de Cidadania',
      casa: 'CAMARA',
      funcao: 'Titular',
      inicio: new Date('2026-03-05T00:00:00.000Z'),
      fim: null,
      fetchedAt,
    });
  });
});

describe('mappers de indicadores do Senado', () => {
  it('normaliza votação e preserva códigos oficiais de resultado e voto', () => {
    const external = senadoVotacoesSchema.parse(senadoVotacoesFixture)[0];

    expect(mapSenadoVotacao(external, fetchedAt)).toEqual({
      source: 'SENADO',
      externalId: '7102',
      data: new Date('2026-08-12T00:00:00.000Z'),
      descricao:
        'Votação nominal do Projeto de Lei Complementar nº 114, de 2026.',
      resultado: 'A',
      casa: 'SF',
      proposicaoExternalId: 9_095_355,
      fetchedAt,
    });
    expect(mapSenadoVoto(external, external.votos[0], fetchedAt)).toEqual({
      source: 'SENADO',
      votacaoExternalId: '7102',
      parlamentarExternalId: 5672,
      voto: 'Sim',
      data: new Date('2026-08-12T00:00:00.000Z'),
      fetchedAt,
    });
  });

  it('normaliza comissão atual sem fabricar data final', () => {
    const external = senadoComissoesResponseSchema.parse(
      senadoComissoesResponseFixture,
    )[0];

    expect(mapSenadoParticipacaoOrgao(5672, external, fetchedAt)).toEqual({
      source: 'SENADO',
      orgaoExternalId: 38,
      parlamentarExternalId: 5672,
      sigla: 'CAE',
      nome: 'Comissão de Assuntos Econômicos',
      casa: 'SF',
      funcao: 'Titular',
      inicio: new Date('2025-11-26T00:00:00.000Z'),
      fim: null,
      fetchedAt,
    });
  });
});
