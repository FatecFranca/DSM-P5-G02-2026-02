import {
  CamaraInvalidResponseError,
  CamaraTimeoutError,
  CamaraUnavailableError,
  DeputadoNotFoundError,
  ProposicaoNotFoundError,
} from './camara.errors.js';
import {
  camaraDetailResponseSchema,
  camaraDeputadoOrgaosResponseSchema,
  camaraListResponseSchema,
  camaraProposicaoAutoresResponseSchema,
  camaraProposicaoDetailResponseSchema,
  camaraProposicaoListResponseSchema,
  camaraProposicaoTemasResponseSchema,
  camaraVotacoesResponseSchema,
  camaraVotosResponseSchema,
} from './camara.schemas.js';
import type {
  CamaraDetailResponse,
  CamaraDeputadoOrgaosResponse,
  CamaraGateway,
  CamaraListResponse,
  CamaraPagination,
  CamaraIndicadorPeriodQuery,
  CamaraProposicaoAutoresResponse,
  CamaraProposicaoDetailResponse,
  CamaraProposicaoListResponse,
  CamaraProposicaoQuery,
  CamaraProposicaoTemasResponse,
  CamaraVotacaoQuery,
  CamaraVotacoesResponse,
  CamaraVotosResponse,
} from './camara.types.js';

const DEFAULT_TIMEOUT_MS = 5_000;

interface CamaraClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

export class CamaraClient implements CamaraGateway {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(options: CamaraClientOptions) {
    this.baseUrl = options.baseUrl.endsWith('/')
      ? options.baseUrl
      : `${options.baseUrl}/`;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetcher = options.fetcher ?? globalThis.fetch;
  }

  async listDeputados(
    pagination: CamaraPagination,
  ): Promise<CamaraListResponse> {
    const url = new URL('deputados', this.baseUrl);
    url.searchParams.set('pagina', String(pagination.pagina));
    url.searchParams.set('itens', String(pagination.itens));

    const payload = await this.request(url);
    const parsed = camaraListResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new CamaraInvalidResponseError(parsed.error);
    }

    return parsed.data;
  }

  async getDeputado(id: number): Promise<CamaraDetailResponse> {
    const url = new URL(`deputados/${id}`, this.baseUrl);
    const payload = await this.request(url, 'deputado');
    const parsed = camaraDetailResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new CamaraInvalidResponseError(parsed.error);
    }

    return parsed.data;
  }

  async listProposicoes(
    query: CamaraProposicaoQuery,
  ): Promise<CamaraProposicaoListResponse> {
    const url = new URL('proposicoes', this.baseUrl);
    url.searchParams.set('ano', String(query.ano));
    url.searchParams.set('idDeputadoAutor', query.deputadoIds.join(','));
    url.searchParams.set('pagina', String(query.pagina));
    url.searchParams.set('itens', String(query.itens));
    url.searchParams.set('ordenarPor', 'id');
    url.searchParams.set('ordem', 'ASC');

    return this.parse(
      await this.request(url),
      camaraProposicaoListResponseSchema,
    );
  }

  async getProposicao(id: number): Promise<CamaraProposicaoDetailResponse> {
    return this.getProposicaoResource(
      `proposicoes/${id}`,
      camaraProposicaoDetailResponseSchema,
      true,
    );
  }

  async getProposicaoAutores(
    id: number,
  ): Promise<CamaraProposicaoAutoresResponse> {
    return this.getProposicaoResource(
      `proposicoes/${id}/autores`,
      camaraProposicaoAutoresResponseSchema,
    );
  }

  async getProposicaoTemas(id: number): Promise<CamaraProposicaoTemasResponse> {
    return this.getProposicaoResource(
      `proposicoes/${id}/temas`,
      camaraProposicaoTemasResponseSchema,
    );
  }

  async listVotacoes(
    query: CamaraVotacaoQuery,
  ): Promise<CamaraVotacoesResponse> {
    const url = new URL('votacoes', this.baseUrl);
    this.setPeriodPagination(url, query);
    if (query.orgaoId !== undefined) {
      url.searchParams.set('idOrgao', String(query.orgaoId));
    }
    url.searchParams.set('ordenarPor', 'dataHoraRegistro');
    url.searchParams.set('ordem', 'DESC');
    return this.parse(await this.request(url), camaraVotacoesResponseSchema);
  }

  async getVotos(votacaoId: string): Promise<CamaraVotosResponse> {
    const url = new URL(`votacoes/${votacaoId}/votos`, this.baseUrl);
    return this.parse(await this.request(url), camaraVotosResponseSchema);
  }

  async listDeputadoOrgaos(
    id: number,
    query: CamaraIndicadorPeriodQuery,
  ): Promise<CamaraDeputadoOrgaosResponse> {
    const url = new URL(`deputados/${id}/orgaos`, this.baseUrl);
    this.setPeriodPagination(url, query);
    return this.parse(
      await this.request(url),
      camaraDeputadoOrgaosResponseSchema,
    );
  }

  private setPeriodPagination(
    url: URL,
    query: CamaraIndicadorPeriodQuery,
  ): void {
    url.searchParams.set('dataInicio', query.dataInicio);
    url.searchParams.set('dataFim', query.dataFim);
    url.searchParams.set('pagina', String(query.pagina));
    url.searchParams.set('itens', String(query.itens));
  }

  private async getProposicaoResource<T>(
    path: string,
    schema: {
      safeParse(
        value: unknown,
      ): { success: true; data: T } | { success: false; error: unknown };
    },
    detailRequest = false,
  ): Promise<T> {
    const payload = await this.request(
      new URL(path, this.baseUrl),
      detailRequest ? 'proposicao' : undefined,
    );
    return this.parse(payload, schema);
  }

  private parse<T>(
    payload: unknown,
    schema: {
      safeParse(
        value: unknown,
      ): { success: true; data: T } | { success: false; error: unknown };
    },
  ): T {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new CamaraInvalidResponseError(parsed.error);
    }
    return parsed.data;
  }

  private async request(
    url: URL,
    notFoundResource?: 'deputado' | 'proposicao',
  ): Promise<unknown> {
    const signal = AbortSignal.timeout(this.timeoutMs);
    let response: Response;

    try {
      response = await this.fetcher(url, {
        headers: { accept: 'application/json' },
        signal,
      });
    } catch (cause) {
      if (signal.aborted) {
        throw new CamaraTimeoutError(cause);
      }

      throw new CamaraUnavailableError(cause);
    }

    if (response.status === 404 && notFoundResource) {
      throw notFoundResource === 'deputado'
        ? new DeputadoNotFoundError()
        : new ProposicaoNotFoundError();
    }

    if (!response.ok) {
      throw new CamaraUnavailableError();
    }

    try {
      return await response.json();
    } catch (cause) {
      throw new CamaraInvalidResponseError(cause);
    }
  }
}
