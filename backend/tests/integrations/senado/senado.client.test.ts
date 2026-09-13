import { describe, expect, it } from 'vitest';

import { SenadoClient } from '../../../src/integrations/senado/senado.client.js';
import {
  SenadoInvalidResponseError,
  SenadoMateriaNotFoundError,
  SenadoTimeoutError,
  SenadoUnavailableError,
} from '../../../src/integrations/senado/senado.errors.js';
import {
  senadoMateriaDetailFixture,
  senadoMateriaListFixture,
} from '../../fixtures/senado-materias.js';
import {
  senadoCurrentSenatorFixture,
  senadoCurrentSenatorsResponseFixture,
} from '../../fixtures/senado.js';
import {
  senadoComissoesResponseFixture,
  senadoVotacoesFixture,
} from '../../fixtures/indicadores.js';

const baseUrl = 'https://legis.senado.leg.br/dadosabertos';

function response(
  body: string,
  status = 200,
  contentType = 'application/json',
) {
  return new Response(body, {
    status,
    headers: { 'content-type': contentType },
  });
}

function jsonResponse(body: unknown, status = 200) {
  return response(JSON.stringify(body), status);
}

function toUrl(input: RequestInfo | URL): URL {
  if (input instanceof URL) {
    return input;
  }
  return new URL(input instanceof Request ? input.url : input);
}

describe('SenadoClient', () => {
  it('lista senadores atuais usando o endpoint JSON v4 oficial', async () => {
    let requestedUrl: URL | undefined;
    let requestedAccept: string | undefined;
    const fetcher: typeof fetch = (input, init) => {
      requestedUrl = toUrl(input);
      requestedAccept = new Headers(init?.headers).get('accept') ?? undefined;
      return Promise.resolve(
        jsonResponse(senadoCurrentSenatorsResponseFixture),
      );
    };

    const senators = await new SenadoClient({
      baseUrl,
      fetcher,
    }).listCurrentSenators();

    expect(senators).toHaveLength(1);
    expect(senators[0]?.IdentificacaoParlamentar.CodigoParlamentar).toBe(5672);
    expect(requestedUrl?.pathname).toBe(
      '/dadosabertos/senador/lista/atual.json',
    );
    expect(requestedUrl?.searchParams.get('v')).toBe('4');
    expect(requestedAccept).toBe('application/json');
  });

  it('aceita uma lista oficial vazia', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(
        jsonResponse({
          ListaParlamentarEmExercicio: {
            Metadados:
              senadoCurrentSenatorsResponseFixture.ListaParlamentarEmExercicio
                .Metadados,
          },
        }),
      );

    await expect(
      new SenadoClient({ baseUrl, fetcher }).listCurrentSenators(),
    ).resolves.toEqual([]);
  });

  it.each([400, 404, 429, 500, 503])(
    'traduz HTTP %i para indisponibilidade segura',
    async (status) => {
      const fetcher: typeof fetch = () =>
        Promise.resolve(jsonResponse({ status }, status));

      await expect(
        new SenadoClient({ baseUrl, fetcher }).listCurrentSenators(),
      ).rejects.toBeInstanceOf(SenadoUnavailableError);
    },
  );

  it('interrompe requisição que excede o timeout', async () => {
    const fetcher: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new Error('Requisição abortada.')),
          { once: true },
        );
      });

    await expect(
      new SenadoClient({
        baseUrl,
        fetcher,
        timeoutMs: 5,
      }).listCurrentSenators(),
    ).rejects.toBeInstanceOf(SenadoTimeoutError);
  });

  it('rejeita JSON inválido', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(response('{inválido', 200));

    await expect(
      new SenadoClient({ baseUrl, fetcher }).listCurrentSenators(),
    ).rejects.toBeInstanceOf(SenadoInvalidResponseError);
  });

  it('rejeita payload fora do schema oficial necessário', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(
        jsonResponse({
          ...senadoCurrentSenatorsResponseFixture,
          ListaParlamentarEmExercicio: {
            ...senadoCurrentSenatorsResponseFixture.ListaParlamentarEmExercicio,
            Parlamentares: {
              Parlamentar: [
                {
                  ...senadoCurrentSenatorFixture,
                  IdentificacaoParlamentar: {
                    ...senadoCurrentSenatorFixture.IdentificacaoParlamentar,
                    CodigoParlamentar: 'inválido',
                  },
                },
              ],
            },
          },
        }),
      );

    await expect(
      new SenadoClient({ baseUrl, fetcher }).listCurrentSenators(),
    ).rejects.toBeInstanceOf(SenadoInvalidResponseError);
  });

  it('rejeita formato inesperado em vez de tratar XML como JSON', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(response('<ListaParlamentar />', 200, 'application/xml'));

    await expect(
      new SenadoClient({ baseUrl, fetcher }).listCurrentSenators(),
    ).rejects.toBeInstanceOf(SenadoInvalidResponseError);
  });
});

describe('SenadoClient para matérias', () => {
  it('lista matérias com os filtros oficiais de ano, autor e sigla', async () => {
    let requestedUrl: URL | undefined;
    const fetcher: typeof fetch = (input) => {
      requestedUrl = toUrl(input);
      return Promise.resolve(jsonResponse(senadoMateriaListFixture));
    };
    const client = new SenadoClient({ baseUrl, fetcher });

    const result = await client.listMaterias({
      ano: 2026,
      senadorId: 5672,
      siglas: ['INS', 'PL'],
    });

    expect(result).toHaveLength(2);
    expect(requestedUrl?.pathname).toBe('/dadosabertos/processo.json');
    expect(requestedUrl?.searchParams.get('ano')).toBe('2026');
    expect(requestedUrl?.searchParams.get('codigoParlamentarAutor')).toBe(
      '5672',
    );
    expect(requestedUrl?.searchParams.getAll('sigla')).toEqual(['INS', 'PL']);
  });

  it('aceita uma listagem vazia', async () => {
    const fetcher: typeof fetch = () => Promise.resolve(jsonResponse([]));

    await expect(
      new SenadoClient({ baseUrl, fetcher }).listMaterias({
        ano: 2026,
        senadorId: 5672,
        siglas: [],
      }),
    ).resolves.toEqual([]);
  });

  it('consulta detalhe com múltiplos autores e temas oficiais', async () => {
    let requestedUrl: URL | undefined;
    const fetcher: typeof fetch = (input) => {
      requestedUrl = toUrl(input);
      return Promise.resolve(jsonResponse(senadoMateriaDetailFixture));
    };

    const result = await new SenadoClient({
      baseUrl,
      fetcher,
    }).getMateriaById(9_048_130);

    expect(result.data.documento.autoria).toHaveLength(2);
    expect(result.data.classificacoes).toHaveLength(2);
    expect(result.uri).toBe(requestedUrl?.toString());
    expect(requestedUrl?.pathname).toBe('/dadosabertos/processo/9048130.json');
  });

  it('traduz 404 de detalhe para matéria não encontrada', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(jsonResponse({ status: 404 }, 404));

    await expect(
      new SenadoClient({ baseUrl, fetcher }).getMateriaById(999_999_999),
    ).rejects.toBeInstanceOf(SenadoMateriaNotFoundError);
  });

  it.each([
    [{ id: 'inválido' }],
    { ...senadoMateriaDetailFixture, classificacoes: 'inválido' },
  ])('rejeita payload estrutural inválido %#', async (payload) => {
    const fetcher: typeof fetch = () => Promise.resolve(jsonResponse(payload));
    const client = new SenadoClient({ baseUrl, fetcher });

    const request = Array.isArray(payload)
      ? client.listMaterias({ ano: 2026, senadorId: 5672, siglas: [] })
      : client.getMateriaById(9_048_130);
    await expect(request).rejects.toBeInstanceOf(SenadoInvalidResponseError);
  });
});

describe('SenadoClient para indicadores', () => {
  it('lista votos nominais pelo endpoint atual com senador e período', async () => {
    let requestedUrl: URL | undefined;
    const fetcher: typeof fetch = (input) => {
      requestedUrl = toUrl(input);
      return Promise.resolve(jsonResponse(senadoVotacoesFixture));
    };

    const response = await new SenadoClient({ baseUrl, fetcher }).listVotacoes({
      senadorId: 5672,
      dataInicio: '2026-08-12',
      dataFim: '2026-08-12',
    });

    expect(response[0]?.codigoSessaoVotacao).toBe(7102);
    expect(response[0]?.votos[0]?.siglaVotoParlamentar).toBe('Sim');
    expect(requestedUrl?.pathname).toBe('/dadosabertos/votacao.json');
    expect(requestedUrl?.searchParams.get('codigoParlamentar')).toBe('5672');
    expect(requestedUrl?.searchParams.get('dataInicio')).toBe('2026-08-12');
    expect(requestedUrl?.searchParams.get('dataFim')).toBe('2026-08-12');
  });

  it('lista somente comissões atuais pelo contrato oficial v5', async () => {
    let requestedUrl: URL | undefined;
    const fetcher: typeof fetch = (input) => {
      requestedUrl = toUrl(input);
      return Promise.resolve(jsonResponse(senadoComissoesResponseFixture));
    };

    const response = await new SenadoClient({
      baseUrl,
      fetcher,
    }).listSenadorComissoes(5672);

    expect(response).toHaveLength(1);
    expect(response[0]?.IdentificacaoComissao.CodigoComissao).toBe(38);
    expect(requestedUrl?.pathname).toBe(
      '/dadosabertos/senador/5672/comissoes.json',
    );
    expect(requestedUrl?.searchParams.get('ativo')).toBe('S');
    expect(requestedUrl?.searchParams.get('v')).toBe('5');
  });

  it('aceita votações e comissões vazias', async () => {
    const payloads = [
      [],
      {
        MembroComissaoParlamentar: {
          Parlamentar: { Codigo: '5672', Nome: 'Senador Fictício' },
        },
      },
    ];
    const fetcher: typeof fetch = () =>
      Promise.resolve(jsonResponse(payloads.shift()));
    const client = new SenadoClient({ baseUrl, fetcher });

    await expect(
      client.listVotacoes({
        senadorId: 5672,
        dataInicio: '2026-08-12',
        dataFim: '2026-08-12',
      }),
    ).resolves.toEqual([]);
    await expect(client.listSenadorComissoes(5672)).resolves.toEqual([]);
  });

  it.each([400, 404, 500, 503])(
    'traduz HTTP %i dos indicadores para indisponibilidade',
    async (status) => {
      const fetcher: typeof fetch = () =>
        Promise.resolve(jsonResponse({ status }, status));

      await expect(
        new SenadoClient({ baseUrl, fetcher }).listVotacoes({
          senadorId: 5672,
          dataInicio: '2026-08-12',
          dataFim: '2026-08-12',
        }),
      ).rejects.toBeInstanceOf(SenadoUnavailableError);
    },
  );

  it('interrompe consulta de indicadores que excede o timeout', async () => {
    const fetcher: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error()), {
          once: true,
        });
      });

    await expect(
      new SenadoClient({ baseUrl, fetcher, timeoutMs: 5 }).listSenadorComissoes(
        5672,
      ),
    ).rejects.toBeInstanceOf(SenadoTimeoutError);
  });

  it.each([
    [[{ codigoSessaoVotacao: 'inválido' }], 'votacoes'],
    [
      {
        MembroComissaoParlamentar: {
          Parlamentar: {
            Codigo: '5672',
            Nome: 'Senador Fictício',
            MembroComissoes: { Comissao: [{ IdentificacaoComissao: {} }] },
          },
        },
      },
      'comissoes',
    ],
  ])('rejeita payload inválido de %s', async (payload, resource) => {
    const fetcher: typeof fetch = () => Promise.resolve(jsonResponse(payload));
    const client = new SenadoClient({ baseUrl, fetcher });
    const request =
      resource === 'votacoes'
        ? client.listVotacoes({
            senadorId: 5672,
            dataInicio: '2026-08-12',
            dataFim: '2026-08-12',
          })
        : client.listSenadorComissoes(5672);

    await expect(request).rejects.toBeInstanceOf(SenadoInvalidResponseError);
  });
});
