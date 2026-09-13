import type { SenadoCurrentSenator } from '../../integrations/senado/senado.types.js';
import type { ParlamentarInput } from './parlamentar.types.js';

function optionalString(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

export function mapSenadoSenatorToParlamentar(
  senator: SenadoCurrentSenator,
  fetchedAt: Date,
): ParlamentarInput {
  const identification = senator.IdentificacaoParlamentar;

  return {
    externalId: identification.CodigoParlamentar,
    source: 'SENADO',
    casa: 'SENADO',
    nome: identification.NomeParlamentar.trim(),
    nomeCivil: optionalString(identification.NomeCompletoParlamentar),
    partido: optionalString(identification.SiglaPartidoParlamentar),
    uf: optionalString(identification.UfParlamentar),
    fotoUrl: optionalString(identification.UrlFotoParlamentar),
    email: null,
    situacao: optionalString(senator.Mandato?.DescricaoParticipacao),
    legislatura: null,
    fetchedAt,
  };
}
