import { describe, expect, it } from 'vitest';

import { senadoMateriaDetailSchema } from '../../../src/integrations/senado/senado.schemas.js';
import { mapSenadoMateriaToProposicao } from '../../../src/modules/proposicoes/senado-materia.mapper.js';
import {
  senadoMateriaDetailFixture,
  senadoMateriaWithoutThemesFixture,
} from '../../fixtures/senado-materias.js';

describe('mapSenadoMateriaToProposicao', () => {
  it('normaliza matéria, múltiplos autores, vínculos e temas oficiais', () => {
    const detail = senadoMateriaDetailSchema.parse(senadoMateriaDetailFixture);
    const fetchedAt = new Date('2026-09-06T21:00:00.000Z');

    const result = mapSenadoMateriaToProposicao(
      {
        data: detail,
        uri: 'https://legis.senado.leg.br/dadosabertos/processo/9048130.json',
      },
      new Set([5672]),
      fetchedAt,
    );

    expect(result).toEqual({
      externalId: 9_048_130,
      source: 'SENADO',
      tipo: 'INS',
      numero: 15,
      ano: 2026,
      ementa:
        'Sugere medidas relativas ao provimento de vagas de concurso público.',
      descricao: 'Explicação oficial fictícia para teste.',
      dataApresentacao: new Date('2026-05-14T00:00:00.000Z'),
      situacao: 'INDICAÇÃO ENCAMINHADA',
      uri: 'https://legis.senado.leg.br/dadosabertos/processo/9048130.json',
      urlFonte:
        'https://legis.senado.gov.br/sdleg-getter/documento?dm=10223126',
      autores: [
        {
          externalId: 5672,
          nome: 'Senador Fictício',
          tipo: 'SENADOR',
          uri: null,
          parlamentarExternalId: 5672,
        },
        {
          externalId: 55_126,
          nome: 'Presidência da República',
          tipo: 'PRESIDENTE_REPUBLICA',
          uri: null,
          parlamentarExternalId: null,
        },
      ],
      temasOficiais: [
        { codTema: 33_808_942, tema: 'Política Social / Saúde' },
        {
          codTema: 33_809_423,
          tema: 'Política Social / Pessoas com Deficiência',
        },
      ],
      fetchedAt,
    });
  });

  it('preserva autores sem vínculo e ausência oficial de temas', () => {
    const detail = senadoMateriaDetailSchema.parse(
      senadoMateriaWithoutThemesFixture,
    );

    const result = mapSenadoMateriaToProposicao(
      {
        data: detail,
        uri: 'https://legis.senado.leg.br/dadosabertos/processo/9085481.json',
      },
      new Set(),
      new Date('2026-09-06T21:00:00.000Z'),
    );

    expect(result).toMatchObject({
      externalId: 9_085_481,
      source: 'SENADO',
      numero: 24,
      autores: [{ parlamentarExternalId: null }],
      temasOficiais: [],
    });
  });

  it('mescla autoria da iniciativa sem duplicar autores do documento', () => {
    const author = senadoMateriaDetailFixture.documento.autoria[0];
    const detail = senadoMateriaDetailSchema.parse({
      ...senadoMateriaDetailFixture,
      documento: {
        ...senadoMateriaDetailFixture.documento,
        autoria: [],
      },
      autoriaIniciativa: [author],
    });

    const result = mapSenadoMateriaToProposicao(
      {
        data: detail,
        uri: 'https://legis.senado.leg.br/dadosabertos/processo/9048130.json',
      },
      new Set([5672]),
      new Date('2026-09-06T21:00:00.000Z'),
    );

    expect(result.autores).toHaveLength(1);
    expect(result.autores[0]?.parlamentarExternalId).toBe(5672);
  });
});
