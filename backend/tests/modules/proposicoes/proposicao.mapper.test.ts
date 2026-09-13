import { describe, expect, it } from 'vitest';

import { mapCamaraProposicaoToProposicao } from '../../../src/modules/proposicoes/proposicao.mapper.js';
import {
  camaraProposicaoAutoresResponseFixture,
  camaraProposicaoDetailFixture,
  camaraProposicaoTemasResponseFixture,
} from '../../fixtures/camara.js';

describe('mapCamaraProposicaoToProposicao', () => {
  it('normaliza detalhe, múltiplos autores e temas em ordem determinística', () => {
    const fetchedAt = new Date('2026-09-05T12:00:00.000Z');

    const result = mapCamaraProposicaoToProposicao(
      camaraProposicaoDetailFixture,
      [...camaraProposicaoAutoresResponseFixture.dados].reverse(),
      [...camaraProposicaoTemasResponseFixture.dados].reverse(),
      new Set([204_379]),
      fetchedAt,
    );

    expect(result).toEqual({
      externalId: 2_256_735,
      source: 'CAMARA',
      tipo: 'PL',
      numero: 1234,
      ano: 2025,
      ementa: 'Dispõe sobre uma política pública fictícia.',
      descricao: 'Descrição detalhada fictícia da proposição.',
      dataApresentacao: new Date('2025-03-10T10:30'),
      situacao: 'Aguardando Despacho do Presidente da Câmara',
      uri: 'https://dadosabertos.camara.leg.br/api/v2/proposicoes/2256735',
      urlFonte:
        'https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=999',
      autores: [
        {
          externalId: 204_379,
          nome: 'Deputado Fictício',
          tipo: 'Deputado',
          uri: 'https://dadosabertos.camara.leg.br/api/v2/deputados/204379',
          parlamentarExternalId: 204_379,
        },
        {
          externalId: null,
          nome: 'Poder Executivo',
          tipo: 'Órgão do Poder Executivo',
          uri: null,
          parlamentarExternalId: null,
        },
      ],
      temasOficiais: [
        { codTema: 40, tema: 'Educação' },
        { codTema: 62, tema: 'Ciência, Tecnologia e Inovação' },
      ],
      fetchedAt,
    });
  });

  it('aceita campos opcionais, autor sem vínculo e proposição sem tema', () => {
    const result = mapCamaraProposicaoToProposicao(
      {
        ...camaraProposicaoDetailFixture,
        ementa: null,
        ementaDetalhada: null,
        dataApresentacao: null,
        statusProposicao: null,
        urlInteiroTeor: null,
      },
      [camaraProposicaoAutoresResponseFixture.dados[0]],
      [],
      new Set(),
      new Date('2026-09-05T12:00:00.000Z'),
    );

    expect(result).toMatchObject({
      ementa: null,
      descricao: null,
      dataApresentacao: null,
      situacao: null,
      urlFonte: null,
      temasOficiais: [],
      autores: [{ parlamentarExternalId: null }],
    });
  });
});
