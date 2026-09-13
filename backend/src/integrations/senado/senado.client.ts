import {
  SenadoInvalidResponseError,
  SenadoMateriaNotFoundError,
  SenadoTimeoutError,
  SenadoUnavailableError,
} from './senado.errors.js';
import {
  senadoCurrentSenatorsResponseSchema,
  senadoComissoesResponseSchema,
  senadoMateriaDetailSchema,
  senadoMateriaListResponseSchema,
  senadoVotacoesSchema,
} from './senado.schemas.js';
import type {
  SenadoCurrentSenator,
  SenadoGateway,
  SenadoComissao,
  SenadoIndicadoresGateway,
  SenadoMateriaDetailResource,
  SenadoMateriaGateway,
  SenadoMateriaListItem,
  SenadoMateriaQuery,
  SenadoVotacao,
  SenadoVotacaoQuery,
} from './senado.types.js';

const DEFAULT_TIMEOUT_MS = 5_000;

interface SenadoClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

export class SenadoClient
  implements SenadoGateway, SenadoMateriaGateway, SenadoIndicadoresGateway
{
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(options: SenadoClientOptions) {
    this.baseUrl = options.baseUrl.endsWith('/')
      ? options.baseUrl
      : `${options.baseUrl}/`;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetcher = options.fetcher ?? globalThis.fetch;
  }

  async listCurrentSenators(): Promise<SenadoCurrentSenator[]> {
    const url = new URL('senador/lista/atual.json', this.baseUrl);
    url.searchParams.set('v', '4');
    const parsed = await this.request(url, senadoCurrentSenatorsResponseSchema);

    return parsed.ListaParlamentarEmExercicio.Parlamentares?.Parlamentar ?? [];
  }

  async listMaterias(
    query: SenadoMateriaQuery,
  ): Promise<SenadoMateriaListItem[]> {
    const url = new URL('processo.json', this.baseUrl);
    url.searchParams.set('ano', String(query.ano));
    url.searchParams.set('codigoParlamentarAutor', String(query.senadorId));
    for (const sigla of query.siglas) {
      url.searchParams.append('sigla', sigla);
    }

    return this.request(url, senadoMateriaListResponseSchema);
  }

  async getMateriaById(id: number): Promise<SenadoMateriaDetailResource> {
    const url = new URL(`processo/${id}.json`, this.baseUrl);
    return {
      data: await this.request(url, senadoMateriaDetailSchema, true),
      uri: url.toString(),
    };
  }

  async listVotacoes(query: SenadoVotacaoQuery): Promise<SenadoVotacao[]> {
    const url = new URL('votacao.json', this.baseUrl);
    url.searchParams.set('codigoParlamentar', String(query.senadorId));
    url.searchParams.set('dataInicio', query.dataInicio);
    url.searchParams.set('dataFim', query.dataFim);
    return this.request(url, senadoVotacoesSchema);
  }

  async listSenadorComissoes(id: number): Promise<SenadoComissao[]> {
    const url = new URL(`senador/${id}/comissoes.json`, this.baseUrl);
    url.searchParams.set('ativo', 'S');
    url.searchParams.set('v', '5');
    return this.request(url, senadoComissoesResponseSchema);
  }

  private async request<T>(
    url: URL,
    schema: {
      safeParse(
        value: unknown,
      ): { success: true; data: T } | { success: false; error: unknown };
    },
    detailRequest = false,
  ): Promise<T> {
    const signal = AbortSignal.timeout(this.timeoutMs);
    let response: Response;

    try {
      response = await this.fetcher(url, {
        headers: { accept: 'application/json' },
        signal,
      });
    } catch (cause) {
      if (signal.aborted) {
        throw new SenadoTimeoutError(cause);
      }
      throw new SenadoUnavailableError(cause);
    }

    if (response.status === 404 && detailRequest) {
      throw new SenadoMateriaNotFoundError();
    }

    if (!response.ok) {
      throw new SenadoUnavailableError();
    }

    const contentType = response.headers.get('content-type')?.toLowerCase();
    if (!contentType?.includes('json')) {
      throw new SenadoInvalidResponseError();
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (cause) {
      throw new SenadoInvalidResponseError(cause);
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new SenadoInvalidResponseError(parsed.error);
    }

    return parsed.data;
  }
}
