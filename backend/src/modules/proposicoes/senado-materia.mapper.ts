import type { SenadoMateriaDetailResource } from '../../integrations/senado/senado.types.js';
import type { ProposicaoInput } from './proposicao.types.js';

function trimOrNull(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

export function mapSenadoMateriaToProposicao(
  resource: SenadoMateriaDetailResource,
  knownSenatorIds: ReadonlySet<number>,
  fetchedAt: Date,
): ProposicaoInput {
  const materia = resource.data;
  const authors = new Map(
    [...materia.documento.autoria, ...materia.autoriaIniciativa].map(
      (author) => [
        [
          author.siglaTipo,
          author.codigoParlamentar ?? '',
          author.idEnte ?? '',
          author.autor.trim(),
        ].join(':'),
        author,
      ],
    ),
  );
  return {
    externalId: materia.id,
    source: 'SENADO',
    tipo: materia.sigla.trim(),
    numero: materia.numero,
    ano: materia.ano,
    ementa: trimOrNull(materia.conteudo.ementa),
    descricao: trimOrNull(materia.conteudo.explicacaoEmenta),
    dataApresentacao: materia.documento.dataApresentacao
      ? new Date(`${materia.documento.dataApresentacao}T00:00:00.000Z`)
      : null,
    situacao: trimOrNull(materia.situacaoAtual),
    uri: resource.uri,
    urlFonte: materia.documento.url ?? null,
    autores: [...authors.values()]
      .sort(
        (left, right) =>
          (left.ordem ?? Number.MAX_SAFE_INTEGER) -
            (right.ordem ?? Number.MAX_SAFE_INTEGER) ||
          left.autor.localeCompare(right.autor, 'pt-BR'),
      )
      .map((author) => {
        const isKnownSenator =
          author.siglaTipo === 'SENADOR' &&
          author.codigoParlamentar !== undefined &&
          knownSenatorIds.has(author.codigoParlamentar);
        const externalId = author.codigoParlamentar ?? author.idEnte ?? null;

        return {
          externalId,
          nome: author.autor.trim(),
          tipo: author.descricaoTipo?.trim() || author.siglaTipo.trim(),
          uri: null,
          parlamentarExternalId: isKnownSenator
            ? (author.codigoParlamentar ?? null)
            : null,
        };
      }),
    temasOficiais: [...materia.classificacoes]
      .sort(
        (left, right) =>
          left.codigo - right.codigo ||
          left.descricao.localeCompare(right.descricao, 'pt-BR'),
      )
      .map((classification) => ({
        codTema: classification.codigo,
        tema:
          classification.descricaoHierarquia?.trim() ||
          classification.descricao.trim(),
      })),
    fetchedAt,
  };
}
