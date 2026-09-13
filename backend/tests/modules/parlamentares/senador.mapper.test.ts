import { describe, expect, it } from 'vitest';

import { senadoCurrentSenatorSchema } from '../../../src/integrations/senado/senado.schemas.js';
import { mapSenadoSenatorToParlamentar } from '../../../src/modules/parlamentares/senador.mapper.js';
import { senadoCurrentSenatorFixture } from '../../fixtures/senado.js';

describe('mapSenadoSenatorToParlamentar', () => {
  it('normaliza um senador completo para o domínio Parlamentar', () => {
    const fetchedAt = new Date('2026-09-06T20:00:00.000Z');
    const senator = senadoCurrentSenatorSchema.parse(
      senadoCurrentSenatorFixture,
    );

    expect(mapSenadoSenatorToParlamentar(senator, fetchedAt)).toEqual({
      externalId: 5672,
      source: 'SENADO',
      casa: 'SENADO',
      nome: 'Senadora Fictícia',
      nomeCivil: 'NOME COMPLETO FICTÍCIO',
      partido: 'ABC',
      uf: 'AC',
      fotoUrl:
        'http://www.senado.leg.br/senadores/img/fotos-oficiais/senador5672.jpg',
      email: null,
      situacao: 'Titular',
      legislatura: null,
      fetchedAt,
    });
  });

  it('normaliza campos opcionais ausentes como null', () => {
    const senator = senadoCurrentSenatorSchema.parse({
      IdentificacaoParlamentar: {
        CodigoParlamentar: '5672',
        NomeParlamentar: ' Senadora Fictícia ',
      },
    });

    expect(
      mapSenadoSenatorToParlamentar(senator, new Date('2026-09-06')),
    ).toMatchObject({
      externalId: 5672,
      nome: 'Senadora Fictícia',
      nomeCivil: null,
      partido: null,
      uf: null,
      fotoUrl: null,
      email: null,
      situacao: null,
      legislatura: null,
    });
  });
});
