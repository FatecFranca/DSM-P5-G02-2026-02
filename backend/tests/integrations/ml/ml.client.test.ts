import { describe, expect, it } from 'vitest';

import { MLClient } from '../../../src/integrations/ml/ml.client.js';
import {
  MLInvalidResponseError,
  MLTimeoutError,
  MLUnavailableError,
} from '../../../src/integrations/ml/ml.errors.js';
import { mlHealthFixture, mlPredictionFixture } from '../../fixtures/ml.js';

const baseUrl = 'http://127.0.0.1:8001';

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

describe('MLClient', () => {
  it('consulta health e valida readiness do modelo', async () => {
    let requestedUrl: URL | undefined;
    let requestedMethod: string | undefined;
    const fetcher: typeof fetch = (input, init) => {
      requestedUrl = toUrl(input);
      requestedMethod = init?.method;
      return Promise.resolve(jsonResponse(mlHealthFixture));
    };

    const health = await new MLClient({ baseUrl, fetcher }).health();

    expect(health).toEqual(mlHealthFixture);
    expect(requestedUrl?.pathname).toBe('/health');
    expect(requestedMethod).toBe('GET');
  });

  it('envia texto para predict e preserva resposta multi-label', async () => {
    let requestBody: unknown;
    let contentType: string | null = null;
    const fetcher: typeof fetch = (_input, init) => {
      if (typeof init?.body !== 'string') {
        throw new TypeError('Body JSON ausente.');
      }
      requestBody = JSON.parse(init.body) as unknown;
      contentType = new Headers(init?.headers).get('content-type');
      return Promise.resolve(jsonResponse(mlPredictionFixture));
    };

    const prediction = await new MLClient({ baseUrl, fetcher }).predict(
      'Institui campanha nacional de vacinação.',
    );

    expect(requestBody).toEqual({
      text: 'Institui campanha nacional de vacinação.',
    });
    expect(contentType).toBe('application/json');
    expect(prediction).toEqual(mlPredictionFixture);
    expect(prediction.labels[0]?.decisionScore).toBe(2.3634);
  });

  it('preserva uma predição sem labels', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(
        jsonResponse({ ...mlPredictionFixture, labels: [], labelCount: 0 }),
      );

    await expect(
      new MLClient({ baseUrl, fetcher }).predict('Texto sem tema positivo.'),
    ).resolves.toMatchObject({ labels: [], labelCount: 0 });
  });

  it('interrompe requisição que excede o timeout', async () => {
    const fetcher: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error()), {
          once: true,
        });
      });

    await expect(
      new MLClient({ baseUrl, fetcher, timeoutMs: 5 }).health(),
    ).rejects.toBeInstanceOf(MLTimeoutError);
  });

  it('traduz falha de conexão para indisponibilidade', async () => {
    const fetcher: typeof fetch = () =>
      Promise.reject(new TypeError('ECONNREFUSED'));

    await expect(
      new MLClient({ baseUrl, fetcher }).health(),
    ).rejects.toBeInstanceOf(MLUnavailableError);
  });

  it('traduz HTTP 500 para indisponibilidade', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(jsonResponse({ detail: 'erro' }, 500));

    await expect(
      new MLClient({ baseUrl, fetcher }).predict('Texto válido.'),
    ).rejects.toBeInstanceOf(MLUnavailableError);
  });

  it('trata HTTP 422 como quebra do contrato de integração', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(jsonResponse({ detail: [] }, 422));

    await expect(
      new MLClient({ baseUrl, fetcher }).predict('Texto válido.'),
    ).rejects.toBeInstanceOf(MLInvalidResponseError);
  });

  it('rejeita JSON inválido', async () => {
    const fetcher: typeof fetch = () => Promise.resolve(response('{inválido'));

    await expect(
      new MLClient({ baseUrl, fetcher }).health(),
    ).rejects.toBeInstanceOf(MLInvalidResponseError);
  });

  it.each([
    { ...mlHealthFixture, modelLoaded: false },
    { ...mlHealthFixture, classes: '32' },
  ])('rejeita health incompatível %#', async (payload) => {
    const fetcher: typeof fetch = () => Promise.resolve(jsonResponse(payload));

    await expect(
      new MLClient({ baseUrl, fetcher }).health(),
    ).rejects.toBeInstanceOf(MLInvalidResponseError);
  });

  it.each([
    { ...mlPredictionFixture, labelCount: 1 },
    {
      ...mlPredictionFixture,
      labels: [{ code: '56', name: 'Saúde', probability: 0.9 }],
      labelCount: 1,
    },
  ])('rejeita predict incompatível %#', async (payload) => {
    const fetcher: typeof fetch = () => Promise.resolve(jsonResponse(payload));

    await expect(
      new MLClient({ baseUrl, fetcher }).predict('Texto válido.'),
    ).rejects.toBeInstanceOf(MLInvalidResponseError);
  });

  it('rejeita content-type que não seja JSON', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(response('<html />', 200, 'text/html'));

    await expect(
      new MLClient({ baseUrl, fetcher }).health(),
    ).rejects.toBeInstanceOf(MLInvalidResponseError);
  });
});
