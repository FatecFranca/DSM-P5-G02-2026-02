import { z } from 'zod';

const nullableOptionalString = z.string().nullable().optional();
const nullableOptionalUrl = z.string().url().nullable().optional();
const positiveOfficialId = z
  .union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/).transform(Number),
  ])
  .pipe(z.number().int().positive());

const senadoIdentificationSchema = z
  .object({
    CodigoParlamentar: positiveOfficialId,
    NomeParlamentar: z.string().trim().min(1),
    NomeCompletoParlamentar: nullableOptionalString,
    SiglaPartidoParlamentar: nullableOptionalString,
    UfParlamentar: nullableOptionalString,
    UrlFotoParlamentar: nullableOptionalUrl,
  })
  .passthrough();

const senadoMandateSchema = z
  .object({
    DescricaoParticipacao: nullableOptionalString,
  })
  .passthrough();

export const senadoCurrentSenatorSchema = z
  .object({
    IdentificacaoParlamentar: senadoIdentificationSchema,
    Mandato: senadoMandateSchema.nullable().optional(),
  })
  .passthrough();

export const senadoCurrentSenatorsResponseSchema = z
  .object({
    ListaParlamentarEmExercicio: z
      .object({
        Metadados: z.object({}).passthrough().optional(),
        Parlamentares: z
          .object({
            Parlamentar: z.array(senadoCurrentSenatorSchema),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

const nonnegativeOfficialInteger = z
  .union([
    z.number().int().nonnegative(),
    z.string().regex(/^\d+$/).transform(Number),
  ])
  .pipe(z.number().int().nonnegative());

export const senadoMateriaListItemSchema = z
  .object({
    id: positiveOfficialId,
    identificacao: nullableOptionalString,
    ementa: nullableOptionalString,
    dataApresentacao: nullableOptionalString,
    situacaoAtual: nullableOptionalString,
    urlDocumento: nullableOptionalUrl,
  })
  .passthrough();

export const senadoMateriaListResponseSchema = z.array(
  senadoMateriaListItemSchema,
);

export const senadoMateriaAuthorSchema = z
  .object({
    autor: z.string().trim().min(1),
    siglaTipo: z.string().trim().min(1),
    descricaoTipo: nullableOptionalString,
    ordem: nonnegativeOfficialInteger.optional(),
    codigoParlamentar: positiveOfficialId.optional(),
    idEnte: positiveOfficialId.optional(),
  })
  .passthrough();

export const senadoMateriaClassificationSchema = z
  .object({
    codigo: positiveOfficialId,
    descricao: z.string().trim().min(1),
    descricaoHierarquia: nullableOptionalString,
  })
  .passthrough();

const senadoMateriaContentSchema = z
  .object({
    ementa: nullableOptionalString,
    explicacaoEmenta: nullableOptionalString,
  })
  .passthrough();

const senadoMateriaDocumentSchema = z
  .object({
    dataApresentacao: nullableOptionalString,
    url: nullableOptionalUrl,
    autoria: z.array(senadoMateriaAuthorSchema).default([]),
  })
  .passthrough();

export const senadoMateriaDetailSchema = z
  .object({
    id: positiveOfficialId,
    sigla: z.string().trim().min(1),
    numero: positiveOfficialId,
    ano: positiveOfficialId,
    conteudo: senadoMateriaContentSchema,
    documento: senadoMateriaDocumentSchema,
    autoriaIniciativa: z.array(senadoMateriaAuthorSchema).default([]),
    situacaoAtual: nullableOptionalString,
    classificacoes: z.array(senadoMateriaClassificationSchema).default([]),
  })
  .passthrough();

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const senadoVotoParlamentarSchema = z
  .object({
    codigoParlamentar: positiveOfficialId,
    nomeParlamentar: z.string().trim().min(1),
    siglaVotoParlamentar: z.string().trim().min(1),
    descricaoVotoParlamentar: nullableOptionalString,
  })
  .passthrough();

export const senadoVotacaoSchema = z
  .object({
    codigoSessaoVotacao: positiveOfficialId,
    codigoSessao: positiveOfficialId,
    dataSessao: isoDateSchema,
    casaSessao: z.string().trim().min(1),
    descricaoVotacao: nullableOptionalString,
    resultadoVotacao: nullableOptionalString,
    idProcesso: positiveOfficialId.optional(),
    votos: z.array(senadoVotoParlamentarSchema).default([]),
  })
  .passthrough();

export const senadoVotacoesSchema = z.array(senadoVotacaoSchema);

export const senadoComissaoSchema = z
  .object({
    IdentificacaoComissao: z
      .object({
        CodigoComissao: positiveOfficialId,
        SiglaComissao: z.string().trim().min(1),
        NomeComissao: z.string().trim().min(1),
        SiglaCasaComissao: z.string().trim().min(1),
      })
      .passthrough(),
    DescricaoParticipacao: nullableOptionalString,
    DataInicio: nullableOptionalString,
    DataFim: nullableOptionalString,
  })
  .passthrough();

const senadoComissaoListSchema = z
  .union([
    z.array(senadoComissaoSchema),
    senadoComissaoSchema.transform((item) => [item]),
  ])
  .optional();

export const senadoComissoesResponseSchema = z
  .object({
    MembroComissaoParlamentar: z
      .object({
        Parlamentar: z
          .object({
            Codigo: positiveOfficialId,
            Nome: z.string().trim().min(1),
            MembroComissoes: z
              .object({ Comissao: senadoComissaoListSchema })
              .passthrough()
              .optional(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough()
  .transform(
    (response) =>
      response.MembroComissaoParlamentar.Parlamentar.MembroComissoes
        ?.Comissao ?? [],
  );
