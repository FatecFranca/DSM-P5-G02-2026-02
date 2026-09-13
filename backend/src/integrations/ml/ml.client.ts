import {
  MLInvalidResponseError,
  MLTimeoutError,
  MLUnavailableError,
} from './ml.errors.js';
import { mlHealthSchema, mlPredictionSchema } from './ml.schemas.js';
import type { MLGateway, MLHealth, MLPrediction } from './ml.types.js';

const DEFAULT_TIMEOUT_MS = 3_000;

interface MLClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

interface Schema<T> {
  safeParse(
    value: unknown,
  ): { success: true; data: T } | { success: false; error: unknown };
}

export class MLClient implements MLGateway {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(options: MLClientOptions) {
    this.baseUrl = options.baseUrl.endsWith('/')
      ? options.baseUrl
      : `${options.baseUrl}/`;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetcher = options.fetcher ?? globalThis.fetch;
  }

  health(): Promise<MLHealth> {
    return this.request('health', mlHealthSchema, { method: 'GET' });
  }

  predict(text: string): Promise<MLPrediction> {
    return this.request('predict', mlPredictionSchema, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  private async request<T>(
    path: string,
    schema: Schema<T>,
    init: { method: 'GET' | 'POST'; body?: string },
  ): Promise<T> {
    const signal = AbortSignal.timeout(this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetcher(new URL(path, this.baseUrl), {
        method: init.method,
        headers: {
          accept: 'application/json',
          ...(init.body === undefined
            ? {}
            : { 'content-type': 'application/json' }),
        },
        ...(init.body === undefined ? {} : { body: init.body }),
        signal,
      });
    } catch (cause) {
      if (signal.aborted) {
        throw new MLTimeoutError(cause);
      }
      throw new MLUnavailableError(cause);
    }

    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) {
        throw new MLInvalidResponseError();
      }
      throw new MLUnavailableError();
    }
    const contentType = response.headers.get('content-type')?.toLowerCase();
    if (!contentType?.includes('json')) {
      throw new MLInvalidResponseError();
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (cause) {
      throw new MLInvalidResponseError(cause);
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new MLInvalidResponseError(parsed.error);
    }
    return parsed.data;
  }
}
