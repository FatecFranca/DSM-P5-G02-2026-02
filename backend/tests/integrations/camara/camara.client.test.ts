import { describe, expect, it } from 'vitest';

import { CamaraClient } from '../../../src/integrations/camara/camara.client.js';
import {
  CamaraInvalidResponseError,
  CamaraTimeoutError,
  CamaraUnavailableError,
  DeputadoNotFoundError,
  ProposicaoNotFoundError,
} from '../../../src/integrations/camara/camara.errors.js';
import {
  camaraDetailResponseFixture,
  camaraListResponseFixture,
  camaraProposicaoAutoresResponseFixture,
  camaraProposicaoDetailResponseFixture,
  camaraProposicaoListResponseFixture,
  camaraProposicaoTemasResponseFixture,
} from '../../fixtures/camara.js';
import {
  camaraOrgaosResponseFixture,
  camaraVotacoesResponseFixture,
  camaraVotosResponseFixture,
} from '../../fixtures/indicadores.js';

const baseUrl = 'https://dadosabertos.camara.leg.br/api/v2';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function toUrl(input: RequestInfo | URL): URL {
  if (input instanceof URL) {
    return input;
  }

  return new URL(input instanceof Request ? input.url : input);
}

describe('CamaraClient', () => {
  it('lista deputados usando a paginação oficial', async () => {
    let requestedUrl: URL | undefined;
    const fetcher: typeof fetch = (input) => {
      requestedUrl = toUrl(input);
      return Promise.resolve(jsonResponse(camaraListResponseFixture));
    };
    const client = new CamaraClient({ baseUrl, fetcher });

    const response = await client.listDeputados({ pagina: 2, itens: 5 });

    expect(response).toEqual(camaraListResponseFixture);
    expect(requestedUrl?.pathname).toBe('/api/v2/deputados');
    expect(requestedUrl?.searchParams.get('pagina')).toBe('2');
    expect(requestedUrl?.searchParams.get('itens')).toBe('5');
  });

  it('consulta um deputado pelo ID oficial', async () => {
    let requestedUrl: URL | undefined;
    const fetcher: typeof fetch = (input) => {
      requestedUrl = toUrl(input);
      return Promise.resolve(jsonResponse(camaraDetailResponseFixture));
    };
    const client = new CamaraClient({ baseUrl, fetcher });

    const response = await client.getDeputado(999_001);

    expect(response).toEqual(camaraDetailResponseFixture);
    expect(requestedUrl?.pathname).toBe('/api/v2/deputados/999001');
  });

  it('lista proposições com filtros oficiais e limite controlado', async () => {
    let requestedUrl: URL | undefined;
    const fetcher: typeof fetch = (input) => {
      requestedUrl = toUrl(input);
      return Promise.resolve(jsonResponse(camaraProposicaoListResponseFixture));
    };
    const client = new CamaraClient({ baseUrl, fetcher });

    const response = await client.listProposicoes({
      ano: 2025,
      deputadoIds: [204_379, 999_001],
      pagina: 1,
      itens: 10,
    });

    expect(response).toEqual(camaraProposicaoListResponseFixture);
    expect(requestedUrl?.pathname).toBe('/api/v2/proposicoes');
    expect(requestedUrl?.searchParams.get('ano')).toBe('2025');
    expect(requestedUrl?.searchParams.get('idDeputadoAutor')).toBe(
      '204379,999001',
    );
    expect(requestedUrl?.searchParams.get('pagina')).toBe('1');
    expect(requestedUrl?.searchParams.get('itens')).toBe('10');
    expect(requestedUrl?.searchParams.get('ordenarPor')).toBe('id');
    expect(requestedUrl?.searchParams.get('ordem')).toBe('ASC');
  });

  it('consulta detalhe, múltiplos autores e múltiplos temas oficiais', async () => {
    const requestedPaths: string[] = [];
    const fetcher: typeof fetch = (input) => {
      const path = toUrl(input).pathname;
      requestedPaths.push(path);
      if (path.endsWith('/autores')) {
        return Promise.resolve(
          jsonResponse(camaraProposicaoAutoresResponseFixture),
        );
      }
      if (path.endsWith('/temas')) {
        return Promise.resolve(
          jsonResponse(camaraProposicaoTemasResponseFixture),
        );
      }
      return Promise.resolve(
        jsonResponse(camaraProposicaoDetailResponseFixture),
      );
    };
    const client = new CamaraClient({ baseUrl, fetcher });

    const detail = await client.getProposicao(2_256_735);
    const authors = await client.getProposicaoAutores(2_256_735);
    const themes = await client.getProposicaoTemas(2_256_735);

    expect(detail).toEqual(camaraProposicaoDetailResponseFixture);
    expect(authors.dados).toHaveLength(2);
    expect(themes.dados).toHaveLength(2);
    expect(requestedPaths).toEqual([
      '/api/v2/proposicoes/2256735',
      '/api/v2/proposicoes/2256735/autores',
      '/api/v2/proposicoes/2256735/temas',
    ]);
  });

  it('aceita proposição sem temas oficiais', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(
        jsonResponse({ ...camaraProposicaoTemasResponseFixture, dados: [] }),
      );
    const client = new CamaraClient({ baseUrl, fetcher });

    const response = await client.getProposicaoTemas(2_256_735);

    expect(response.dados).toEqual([]);
  });

  it('traduz o HTTP 404 de detalhe para deputado não encontrado', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(jsonResponse({ mensagem: 'Não encontrado' }, 404));
    const client = new CamaraClient({ baseUrl, fetcher });

    await expect(client.getDeputado(999_999)).rejects.toBeInstanceOf(
      DeputadoNotFoundError,
    );
  });

  it('traduz o HTTP 404 de detalhe para proposição não encontrada', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(jsonResponse({ mensagem: 'Não encontrado' }, 404));
    const client = new CamaraClient({ baseUrl, fetcher });

    await expect(client.getProposicao(9_999_999)).rejects.toBeInstanceOf(
      ProposicaoNotFoundError,
    );
  });

  it.each([
    [
      'listagem',
      (client: CamaraClient) =>
        client.listProposicoes({
          ano: 2025,
          deputadoIds: [204_379],
          pagina: 1,
          itens: 10,
        }),
    ],
    ['detalhe', (client: CamaraClient) => client.getProposicao(2_256_735)],
    [
      'autores',
      (client: CamaraClient) => client.getProposicaoAutores(2_256_735),
    ],
    ['temas', (client: CamaraClient) => client.getProposicaoTemas(2_256_735)],
  ])(
    'rejeita schema inválido de %s de proposições',
    async (_resource, request) => {
      const fetcher: typeof fetch = () =>
        Promise.resolve(jsonResponse({ dados: [{ id: 'inválido' }] }));
      const client = new CamaraClient({ baseUrl, fetcher });

      await expect(request(client)).rejects.toBeInstanceOf(
        CamaraInvalidResponseError,
      );
    },
  );

  it('traduz falhas HTTP da Câmara para erro de indisponibilidade', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(jsonResponse({ mensagem: 'Falha externa' }, 503));
    const client = new CamaraClient({ baseUrl, fetcher });

    await expect(
      client.listDeputados({ pagina: 1, itens: 20 }),
    ).rejects.toBeInstanceOf(CamaraUnavailableError);
  });

  it('interrompe uma requisição que excede o timeout', async () => {
    const fetcher: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => {
            reject(new Error('Requisição abortada.'));
          },
          { once: true },
        );
      });
    const client = new CamaraClient({ baseUrl, fetcher, timeoutMs: 5 });

    await expect(
      client.listDeputados({ pagina: 1, itens: 20 }),
    ).rejects.toBeInstanceOf(CamaraTimeoutError);
  });

  it('rejeita JSON inválido retornado pela Câmara', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(
        new Response('{json-inválido', {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      );
    const client = new CamaraClient({ baseUrl, fetcher });

    await expect(
      client.listDeputados({ pagina: 1, itens: 20 }),
    ).rejects.toBeInstanceOf(CamaraInvalidResponseError);
  });

  it('rejeita resposta com estrutura externa inválida', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(jsonResponse({ dados: [{ id: 'inválido' }] }));
    const client = new CamaraClient({ baseUrl, fetcher });

    await expect(
      client.listDeputados({ pagina: 1, itens: 20 }),
    ).rejects.toBeInstanceOf(CamaraInvalidResponseError);
  });
});

describe('CamaraClient para indicadores', () => {
  it('lista votações com período, órgão, paginação e limite oficiais', async () => {
    let requestedUrl: URL | undefined;
    const fetcher: typeof fetch = (input) => {
      requestedUrl = toUrl(input);
      return Promise.resolve(jsonResponse(camaraVotacoesResponseFixture));
    };
    const client = new CamaraClient({ baseUrl, fetcher });

    const response = await client.listVotacoes({
      dataInicio: '2026-06-17',
      dataFim: '2026-06-17',
      orgaoId: 180,
      pagina: 1,
      itens: 5,
    });

    expect(response.dados).toHaveLength(1);
    expect(requestedUrl?.pathname).toBe('/api/v2/votacoes');
    expect(requestedUrl?.searchParams.get('dataInicio')).toBe('2026-06-17');
    expect(requestedUrl?.searchParams.get('dataFim')).toBe('2026-06-17');
    expect(requestedUrl?.searchParams.get('idOrgao')).toBe('180');
    expect(requestedUrl?.searchParams.get('pagina')).toBe('1');
    expect(requestedUrl?.searchParams.get('itens')).toBe('5');
    expect(requestedUrl?.searchParams.get('ordenarPor')).toBe(
      'dataHoraRegistro',
    );
    expect(requestedUrl?.searchParams.get('ordem')).toBe('DESC');
  });

  it('consulta múltiplos votos individuais de uma votação', async () => {
    let requestedUrl: URL | undefined;
    const fetcher: typeof fetch = (input) => {
      requestedUrl = toUrl(input);
      return Promise.resolve(jsonResponse(camaraVotosResponseFixture));
    };

    const response = await new CamaraClient({ baseUrl, fetcher }).getVotos(
      '2633410-8',
    );

    expect(response.dados).toHaveLength(2);
    expect(response.dados[0]?.tipoVoto).toBe('Sim');
    expect(requestedUrl?.pathname).toBe('/api/v2/votacoes/2633410-8/votos');
  });

  it('lista órgãos de um deputado com período e limite oficiais', async () => {
    let requestedUrl: URL | undefined;
    const fetcher: typeof fetch = (input) => {
      requestedUrl = toUrl(input);
      return Promise.resolve(jsonResponse(camaraOrgaosResponseFixture));
    };

    const response = await new CamaraClient({
      baseUrl,
      fetcher,
    }).listDeputadoOrgaos(204_379, {
      dataInicio: '2026-06-17',
      dataFim: '2026-06-17',
      pagina: 1,
      itens: 5,
    });

    expect(response.dados[0]?.idOrgao).toBe(2003);
    expect(requestedUrl?.pathname).toBe('/api/v2/deputados/204379/orgaos');
    expect(requestedUrl?.searchParams.get('dataInicio')).toBe('2026-06-17');
    expect(requestedUrl?.searchParams.get('dataFim')).toBe('2026-06-17');
    expect(requestedUrl?.searchParams.get('itens')).toBe('5');
  });

  it.each([
    [
      'votações',
      (client: CamaraClient) =>
        client.listVotacoes({
          dataInicio: '2026-06-17',
          dataFim: '2026-06-17',
          pagina: 1,
          itens: 5,
        }),
    ],
    ['votos', (client: CamaraClient) => client.getVotos('2633410-8')],
    [
      'órgãos',
      (client: CamaraClient) =>
        client.listDeputadoOrgaos(204_379, {
          dataInicio: '2026-06-17',
          dataFim: '2026-06-17',
          pagina: 1,
          itens: 5,
        }),
    ],
  ])('aceita resposta vazia de %s', async (_resource, request) => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(jsonResponse({ dados: [], links: [] }));

    await expect(
      request(new CamaraClient({ baseUrl, fetcher })),
    ).resolves.toMatchObject({
      dados: [],
    });
  });

  it.each([400, 404, 500, 503])(
    'traduz HTTP %i dos indicadores para indisponibilidade',
    async (status) => {
      const fetcher: typeof fetch = () =>
        Promise.resolve(jsonResponse({ status }, status));

      await expect(
        new CamaraClient({ baseUrl, fetcher }).listVotacoes({
          dataInicio: '2026-06-17',
          dataFim: '2026-06-17',
          pagina: 1,
          itens: 5,
        }),
      ).rejects.toBeInstanceOf(CamaraUnavailableError);
    },
  );

  it('interrompe consulta de votações que excede o timeout', async () => {
    const fetcher: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error()), {
          once: true,
        });
      });

    await expect(
      new CamaraClient({ baseUrl, fetcher, timeoutMs: 5 }).listVotacoes({
        dataInicio: '2026-06-17',
        dataFim: '2026-06-17',
        pagina: 1,
        itens: 5,
      }),
    ).rejects.toBeInstanceOf(CamaraTimeoutError);
  });

  it.each([
    [{ dados: [{ id: 123 }] }, 'votacoes'],
    [{ dados: [{ tipoVoto: null }] }, 'votos'],
    [{ dados: [{ idOrgao: 'inválido' }] }, 'orgaos'],
  ])('rejeita payload inválido de %s', async (payload, resource) => {
    const fetcher: typeof fetch = () => Promise.resolve(jsonResponse(payload));
    const client = new CamaraClient({ baseUrl, fetcher });
    const request =
      resource === 'votacoes'
        ? client.listVotacoes({
            dataInicio: '2026-06-17',
            dataFim: '2026-06-17',
            pagina: 1,
            itens: 5,
          })
        : resource === 'votos'
          ? client.getVotos('2633410-8')
          : client.listDeputadoOrgaos(204_379, {
              dataInicio: '2026-06-17',
              dataFim: '2026-06-17',
              pagina: 1,
              itens: 5,
            });

    await expect(request).rejects.toBeInstanceOf(CamaraInvalidResponseError);
  });
});
