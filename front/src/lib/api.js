const RAW = (import.meta.env.VITE_API_URL || "").trim();
export const API_URL = RAW.replace(/\/+$/, "");
const REQUEST_TIMEOUT = 20_000;

const MESSAGES = {
  invalidResponse:
    "A fonte de dados enviou uma resposta inválida. Tente novamente.",
  network: "Não foi possível conectar à fonte de dados. Tente novamente.",
  server: "Não foi possível carregar os dados agora. Tente novamente.",
  timeout: "A fonte de dados demorou mais de 20 segundos para responder.",
  cancelled: "A solicitação foi cancelada.",
};

export class ApiError extends Error {
  constructor(message, { code = "API_ERROR", status = null, cause } = {}) {
    super(message, { cause });
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function isRequestCancelled(error) {
  return error instanceof ApiError && error.code === "REQUEST_CANCELLED";
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const callerSignal = options.signal;
  let timedOut = false;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { Accept: "application/json", ...(options.headers || {}) },
      signal: controller.signal,
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (cause) {
      throw new ApiError(MESSAGES.invalidResponse, {
        code: "INVALID_RESPONSE",
        status: response.status,
        cause,
      });
    }
    if (!response.ok) {
      const serverMessage = data?.error?.message || data?.message;
      throw new ApiError(
        response.status >= 500
          ? MESSAGES.server
          : serverMessage || MESSAGES.server,
        {
          code: data?.error?.code || `HTTP_${response.status}`,
          status: response.status,
        },
      );
    }
    if (!data || typeof data !== "object") {
      throw new ApiError(MESSAGES.invalidResponse, {
        code: "INVALID_RESPONSE",
        status: response.status,
      });
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) {
      throw new ApiError(MESSAGES.timeout, { code: "TIMEOUT", cause: error });
    }
    if (callerSignal?.aborted || error?.name === "AbortError") {
      throw new ApiError(MESSAGES.cancelled, {
        code: "REQUEST_CANCELLED",
        cause: error,
      });
    }
    throw new ApiError(MESSAGES.network, {
      code: "NETWORK_ERROR",
      cause: error,
    });
  } finally {
    window.clearTimeout(timer);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

const get = (path, options) => request(path, options);
const post = (path, body, options = {}) =>
  request(path, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: JSON.stringify(body),
  });

function queryString(values) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  return query.toString();
}

export const api = {
  health: (options) => get("/health", options),
  mlHealth: (options) => get("/api/ml/health", options),
  predict: (text, options) => post("/api/ml/predict", { text }, options),
  temas: (options) => get("/api/temas?source=CAMARA", options),
  deputados: (page = 1, limit = 12, options) =>
    get(
      `/api/parlamentares/deputados?${queryString({ page, limit })}`,
      options,
    ),
  senadores: (page = 1, limit = 12, options) =>
    get(
      `/api/parlamentares/senadores?${queryString({ page, limit })}`,
      options,
    ),
  deputado: (id, options) => get(`/api/parlamentares/deputados/${id}`, options),
  senador: (id, options) => get(`/api/parlamentares/senadores/${id}`, options),
  proposicoes: ({ page = 1, limit = 10, ano, tipo, source } = {}, options) =>
    get(
      `/api/proposicoes?${queryString({ page, limit, ano, tipo, source })}`,
      options,
    ),
  proposicao: (id, source = "CAMARA", options) =>
    get(`/api/proposicoes/${id}?${queryString({ source })}`, options),
  proposicoesDeputado: (id, page = 1, limit = 5, options) =>
    get(
      `/api/parlamentares/deputados/${id}/proposicoes?${queryString({ page, limit })}`,
      options,
    ),
  proposicoesSenador: (id, page = 1, limit = 5, options) =>
    get(
      `/api/parlamentares/senadores/${id}/proposicoes?${queryString({ page, limit })}`,
      options,
    ),
  perfilTematico: (
    id,
    { themeSource = "enriched", startYear, endYear } = {},
    options,
  ) =>
    get(
      `/api/parlamentares/deputados/${id}/perfil-tematico?${queryString({ themeSource, startYear, endYear })}`,
      options,
    ),
  estatisticas: (casa, id, dataInicio, dataFim, options) =>
    get(
      `/api/parlamentares/${casa}/${id}/estatisticas?${queryString({ dataInicio, dataFim })}`,
      options,
    ),
  votacoes: (casa, id, dataInicio, dataFim, page = 1, limit = 6, options) =>
    get(
      `/api/parlamentares/${casa}/${id}/votacoes?${queryString({ dataInicio, dataFim, page, limit })}`,
      options,
    ),
  orgaos: (casa, id, dataInicio, dataFim, page = 1, limit = 6, options) =>
    get(
      `/api/parlamentares/${casa}/${id}/orgaos?${queryString({ dataInicio, dataFim, page, limit })}`,
      options,
    ),
  compatibilidade: (payload, options) =>
    post("/api/compatibilidade", payload, options),
};

export function extractList(payload) {
  if (Array.isArray(payload)) return { data: payload, pagination: null };
  if (Array.isArray(payload?.data)) {
    return { data: payload.data, pagination: payload.pagination || null };
  }
  throw new ApiError(MESSAGES.invalidResponse, { code: "INVALID_RESPONSE" });
}
