import type { z } from 'zod';

import type { camaraDeputadoListItemSchema } from '../../integrations/camara/camara.schemas.js';
import type { ParlamentarInput } from './parlamentar.types.js';

type CamaraDeputadoListItem = z.infer<typeof camaraDeputadoListItemSchema>;

export function mapCamaraDeputadoToParlamentar(
  deputado: CamaraDeputadoListItem,
  fetchedAt: Date,
): ParlamentarInput {
  return {
    externalId: deputado.id,
    source: 'CAMARA',
    casa: 'CAMARA',
    nome: deputado.nome,
    partido: deputado.siglaPartido ?? null,
    uf: deputado.siglaUf ?? null,
    fotoUrl: deputado.urlFoto ?? null,
    email: deputado.email ?? null,
    legislatura: deputado.idLegislatura ?? null,
    fetchedAt,
  };
}
