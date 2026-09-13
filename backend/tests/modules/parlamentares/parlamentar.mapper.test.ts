import { describe, expect, it } from 'vitest';

import { mapCamaraDeputadoToParlamentar } from '../../../src/modules/parlamentares/parlamentar.mapper.js';
import { camaraDeputadoListItemFixture } from '../../fixtures/camara.js';

describe('mapCamaraDeputadoToParlamentar', () => {
  it('normaliza somente dados oficiais disponíveis na listagem', () => {
    const fetchedAt = new Date('2026-09-05T12:00:00.000Z');

    const parlamentar = mapCamaraDeputadoToParlamentar(
      camaraDeputadoListItemFixture,
      fetchedAt,
    );

    expect(parlamentar).toEqual({
      externalId: 999_001,
      source: 'CAMARA',
      casa: 'CAMARA',
      nome: 'Deputada Fictícia',
      partido: 'ABC',
      uf: 'SP',
      fotoUrl: 'https://example.test/deputada-ficticia.jpg',
      email: 'deputada.ficticia@example.test',
      legislatura: 57,
      fetchedAt,
    });
  });
});
