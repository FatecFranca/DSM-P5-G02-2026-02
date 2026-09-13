import { z } from 'zod';

const nullableOptionalString = z.string().nullable().optional();
const nullableOptionalUrl = z.string().url().nullable().optional();

export const camaraDeputadoListItemSchema = z
  .object({
    id: z.number().int().positive(),
    uri: z.string().url(),
    nome: z.string().min(1),
    siglaPartido: nullableOptionalString,
    siglaUf: nullableOptionalString,
    idLegislatura: z.number().int().positive().nullable().optional(),
    urlFoto: nullableOptionalUrl,
    email: nullableOptionalString,
  })
  .passthrough();

const camaraUltimoStatusSchema = z
  .object({
    nome: z.string().min(1),
    siglaPartido: nullableOptionalString,
    siglaUf: nullableOptionalString,
    urlFoto: nullableOptionalUrl,
    email: nullableOptionalString,
    situacao: nullableOptionalString,
  })
  .passthrough();

export const camaraDeputadoDetailSchema = z
  .object({
    id: z.number().int().positive(),
    uri: z.string().url(),
    nomeCivil: nullableOptionalString,
    ultimoStatus: camaraUltimoStatusSchema,
  })
  .passthrough();

const camaraLinkSchema = z
  .object({
    rel: z.string().min(1),
    href: z.string().url(),
  })
  .passthrough();

export const camaraListResponseSchema = z
  .object({
    dados: z.array(camaraDeputadoListItemSchema),
    links: z.array(camaraLinkSchema).optional(),
  })
  .passthrough();

export const camaraDetailResponseSchema = z
  .object({
    dados: camaraDeputadoDetailSchema,
    links: z.array(camaraLinkSchema).optional(),
  })
  .passthrough();

export const camaraProposicaoListItemSchema = z
  .object({
    id: z.number().int().positive(),
    uri: z.string().url(),
    siglaTipo: z.string().min(1),
    codTipo: z.number().int().nonnegative(),
    numero: z.number().int().nonnegative(),
    ano: z.number().int().positive(),
    ementa: nullableOptionalString,
    dataApresentacao: nullableOptionalString,
  })
  .passthrough();

const camaraStatusProposicaoSchema = z
  .object({
    descricaoSituacao: nullableOptionalString,
  })
  .passthrough();

export const camaraProposicaoDetailSchema =
  camaraProposicaoListItemSchema.extend({
    descricaoTipo: nullableOptionalString,
    ementaDetalhada: nullableOptionalString,
    statusProposicao: camaraStatusProposicaoSchema.nullable().optional(),
    urlInteiroTeor: nullableOptionalUrl,
  });

export const camaraProposicaoAutorSchema = z
  .object({
    uri: nullableOptionalUrl,
    nome: z.string().min(1),
    codTipo: z.number().int().nonnegative(),
    tipo: z.string().min(1),
    ordemAssinatura: z.number().int().nonnegative().optional(),
    proponente: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const camaraProposicaoTemaSchema = z
  .object({
    codTema: z.number().int().positive(),
    tema: z.string().min(1),
    relevancia: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const camaraProposicaoListResponseSchema = z
  .object({
    dados: z.array(camaraProposicaoListItemSchema),
    links: z.array(camaraLinkSchema).optional(),
  })
  .passthrough();

export const camaraProposicaoDetailResponseSchema = z
  .object({
    dados: camaraProposicaoDetailSchema,
    links: z.array(camaraLinkSchema).optional(),
  })
  .passthrough();

export const camaraProposicaoAutoresResponseSchema = z
  .object({
    dados: z.array(camaraProposicaoAutorSchema),
    links: z.array(camaraLinkSchema).optional(),
  })
  .passthrough();

export const camaraProposicaoTemasResponseSchema = z
  .object({
    dados: z.array(camaraProposicaoTemaSchema),
    links: z.array(camaraLinkSchema).optional(),
  })
  .passthrough();

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const camaraVotacaoSchema = z
  .object({
    id: z.string().trim().min(1),
    uri: z.string().url(),
    data: isoDateSchema,
    dataHoraRegistro: nullableOptionalString,
    siglaOrgao: z.string().trim().min(1),
    uriOrgao: z.string().url(),
    proposicaoObjeto: nullableOptionalString,
    uriProposicaoObjeto: nullableOptionalUrl,
    descricao: nullableOptionalString,
    aprovacao: z.number().int().min(0).max(1).nullable().optional(),
  })
  .passthrough();

const camaraVotoDeputadoSchema = z
  .object({
    id: z.number().int().positive(),
    uri: z.string().url(),
    nome: z.string().trim().min(1),
    siglaPartido: nullableOptionalString,
    siglaUf: nullableOptionalString,
  })
  .passthrough();

export const camaraVotoSchema = z
  .object({
    tipoVoto: z.string().trim().min(1),
    dataRegistroVoto: nullableOptionalString,
    deputado_: camaraVotoDeputadoSchema,
  })
  .passthrough();

export const camaraDeputadoOrgaoSchema = z
  .object({
    idOrgao: z.number().int().positive(),
    uriOrgao: z.string().url(),
    siglaOrgao: z.string().trim().min(1),
    nomeOrgao: z.string().trim().min(1),
    nomePublicacao: nullableOptionalString,
    titulo: nullableOptionalString,
    codTitulo: nullableOptionalString,
    dataInicio: nullableOptionalString,
    dataFim: nullableOptionalString,
  })
  .passthrough();

export const camaraVotacoesResponseSchema = z
  .object({
    dados: z.array(camaraVotacaoSchema),
    links: z.array(camaraLinkSchema).optional(),
  })
  .passthrough();

export const camaraVotosResponseSchema = z
  .object({
    dados: z.array(camaraVotoSchema),
    links: z.array(camaraLinkSchema).optional(),
  })
  .passthrough();

export const camaraDeputadoOrgaosResponseSchema = z
  .object({
    dados: z.array(camaraDeputadoOrgaoSchema),
    links: z.array(camaraLinkSchema).optional(),
  })
  .passthrough();
