import type {
  CamaraDeputadoOrgaosResponse,
  CamaraVotacoesResponse,
  CamaraVotosResponse,
} from '../../integrations/camara/camara.types.js';
import type {
  ParticipacaoOrgaoInput,
  VotacaoInput,
  VotoInput,
} from './indicador.types.js';

function officialDate(value: string | null | undefined): Date | null {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null;
}

function idFromUri(value: string | null | undefined): number | null {
  const match = value?.match(/\/(\d+)\/?$/);
  const id = match ? Number(match[1]) : Number.NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function mapCamaraVotacao(
  votacao: CamaraVotacoesResponse['dados'][number],
  fetchedAt: Date,
): VotacaoInput {
  return {
    source: 'CAMARA',
    externalId: votacao.id.trim(),
    data: officialDate(votacao.data)!,
    descricao: votacao.descricao?.trim() || null,
    resultado:
      votacao.aprovacao === undefined || votacao.aprovacao === null
        ? null
        : String(votacao.aprovacao),
    casa: 'CAMARA',
    proposicaoExternalId: idFromUri(votacao.uriProposicaoObjeto),
    fetchedAt,
  };
}

export function mapCamaraVoto(
  votacaoExternalId: string,
  data: Date,
  voto: CamaraVotosResponse['dados'][number],
  fetchedAt: Date,
): VotoInput {
  return {
    source: 'CAMARA',
    votacaoExternalId,
    parlamentarExternalId: voto.deputado_.id,
    voto: voto.tipoVoto.trim(),
    data,
    fetchedAt,
  };
}

export function mapCamaraParticipacaoOrgao(
  parlamentarExternalId: number,
  orgao: CamaraDeputadoOrgaosResponse['dados'][number],
  fetchedAt: Date,
): ParticipacaoOrgaoInput {
  return {
    source: 'CAMARA',
    orgaoExternalId: orgao.idOrgao,
    parlamentarExternalId,
    sigla: orgao.siglaOrgao.trim(),
    nome: orgao.nomeOrgao.trim(),
    casa: 'CAMARA',
    funcao: orgao.titulo?.trim() || null,
    inicio: officialDate(orgao.dataInicio),
    fim: officialDate(orgao.dataFim),
    fetchedAt,
  };
}
