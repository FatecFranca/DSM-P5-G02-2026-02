import type {
  SenadoComissao,
  SenadoVotacao,
} from '../../integrations/senado/senado.types.js';
import type {
  ParticipacaoOrgaoInput,
  VotacaoInput,
  VotoInput,
} from './indicador.types.js';

function officialDate(value: string | null | undefined): Date | null {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null;
}

export function mapSenadoVotacao(
  votacao: SenadoVotacao,
  fetchedAt: Date,
): VotacaoInput {
  return {
    source: 'SENADO',
    externalId: String(votacao.codigoSessaoVotacao),
    data: officialDate(votacao.dataSessao)!,
    descricao: votacao.descricaoVotacao?.trim() || null,
    resultado: votacao.resultadoVotacao?.trim() || null,
    casa: votacao.casaSessao.trim(),
    proposicaoExternalId: votacao.idProcesso ?? null,
    fetchedAt,
  };
}

export function mapSenadoVoto(
  votacao: SenadoVotacao,
  voto: SenadoVotacao['votos'][number],
  fetchedAt: Date,
): VotoInput {
  return {
    source: 'SENADO',
    votacaoExternalId: String(votacao.codigoSessaoVotacao),
    parlamentarExternalId: voto.codigoParlamentar,
    voto: voto.siglaVotoParlamentar.trim(),
    data: officialDate(votacao.dataSessao)!,
    fetchedAt,
  };
}

export function mapSenadoParticipacaoOrgao(
  parlamentarExternalId: number,
  comissao: SenadoComissao,
  fetchedAt: Date,
): ParticipacaoOrgaoInput {
  const identification = comissao.IdentificacaoComissao;
  return {
    source: 'SENADO',
    orgaoExternalId: identification.CodigoComissao,
    parlamentarExternalId,
    sigla: identification.SiglaComissao.trim(),
    nome: identification.NomeComissao.trim(),
    casa: identification.SiglaCasaComissao.trim(),
    funcao: comissao.DescricaoParticipacao?.trim() || null,
    inicio: officialDate(comissao.DataInicio),
    fim: officialDate(comissao.DataFim),
    fetchedAt,
  };
}
