import type {
  CamaraProposicaoAutoresResponse,
  CamaraProposicaoDetailResponse,
  CamaraProposicaoTemasResponse,
} from '../../integrations/camara/camara.types.js';
import type {
  ProposicaoAutor,
  ProposicaoInput,
  ProposicaoTemaOficial,
} from './proposicao.types.js';

function externalIdFromUri(uri: string | null | undefined): number | null {
  const match = uri?.match(/\/(\d+)\/?$/);
  if (!match) {
    return null;
  }

  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function mapAuthor(
  author: CamaraProposicaoAutoresResponse['dados'][number],
  knownParlamentarIds: ReadonlySet<number>,
): ProposicaoAutor {
  const externalId = externalIdFromUri(author.uri);
  const isDeputado = author.uri?.includes('/deputados/') === true;

  return {
    externalId,
    nome: author.nome.trim(),
    tipo: author.tipo.trim(),
    uri: author.uri ?? null,
    parlamentarExternalId:
      isDeputado && externalId && knownParlamentarIds.has(externalId)
        ? externalId
        : null,
  };
}

function sortAuthors(authors: ProposicaoAutor[]): ProposicaoAutor[] {
  return authors.sort(
    (left, right) =>
      (left.externalId ?? Number.MAX_SAFE_INTEGER) -
        (right.externalId ?? Number.MAX_SAFE_INTEGER) ||
      left.nome.localeCompare(right.nome, 'pt-BR') ||
      left.tipo.localeCompare(right.tipo, 'pt-BR'),
  );
}

function sortThemes(themes: ProposicaoTemaOficial[]): ProposicaoTemaOficial[] {
  return themes.sort(
    (left, right) =>
      left.codTema - right.codTema ||
      left.tema.localeCompare(right.tema, 'pt-BR'),
  );
}

export function mapCamaraProposicaoToProposicao(
  proposicao: CamaraProposicaoDetailResponse['dados'],
  authors: CamaraProposicaoAutoresResponse['dados'],
  themes: CamaraProposicaoTemasResponse['dados'],
  knownParlamentarIds: ReadonlySet<number>,
  fetchedAt: Date,
): ProposicaoInput {
  return {
    externalId: proposicao.id,
    source: 'CAMARA',
    tipo: proposicao.siglaTipo.trim(),
    numero: proposicao.numero,
    ano: proposicao.ano,
    ementa: proposicao.ementa?.trim() || null,
    descricao: proposicao.ementaDetalhada?.trim() || null,
    dataApresentacao: proposicao.dataApresentacao
      ? new Date(proposicao.dataApresentacao)
      : null,
    situacao: proposicao.statusProposicao?.descricaoSituacao?.trim() || null,
    uri: proposicao.uri,
    urlFonte: proposicao.urlInteiroTeor ?? null,
    autores: sortAuthors(
      authors.map((author) => mapAuthor(author, knownParlamentarIds)),
    ),
    temasOficiais: sortThemes(
      themes.map((theme) => ({
        codTema: theme.codTema,
        tema: theme.tema.trim(),
      })),
    ),
    fetchedAt,
  };
}
