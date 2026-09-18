import { afterEach, describe, expect, it, vi } from "vitest";
import { API_URL, ApiError, api } from "./api.js";

function response({ ok = true, status = 200, body = "{}" } = {}) {
  return {
    ok,
    status,
    text: () => Promise.resolve(body),
  };
}

describe("cliente da API no ambiente local", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("usa a mesma origem para permitir que o Vite encaminhe as requisições", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response({ body: '{"status":"ok","database":"connected"}' }),
      );
    vi.stubGlobal("fetch", fetchMock);

    expect(API_URL).toBe("");
    await api.health();
    expect(fetchMock).toHaveBeenCalledWith(
      "/health",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it("preserva a mensagem pública do backend em erros 4xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          ok: false,
          status: 400,
          body: '{"error":{"code":"VALIDATION_ERROR","message":"Período inválido."}}',
        }),
      ),
    );

    await expect(api.health()).rejects.toMatchObject({
      name: "ApiError",
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Período inválido.",
    });
  });

  it("oculta detalhes técnicos em erros 5xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          ok: false,
          status: 500,
          body: '{"error":{"code":"INTERNAL_SERVER_ERROR","message":"MongoServerError"}}',
        }),
      ),
    );

    await expect(api.health()).rejects.toMatchObject({
      status: 500,
      message: "Não foi possível carregar os dados agora. Tente novamente.",
    });
  });

  it("informa resposta inválida quando um sucesso não contém JSON válido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ body: "<html>erro</html>" })),
    );

    await expect(api.health()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      message:
        "A fonte de dados enviou uma resposta inválida. Tente novamente.",
    });
  });

  it("converte falha de rede em mensagem compreensível", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(api.health()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "Não foi possível conectar à fonte de dados. Tente novamente.",
    });
  });

  it("distingue timeout de cancelamento solicitado pela tela", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );

    const timeoutRequest = api.health();
    const timeoutExpectation = expect(timeoutRequest).rejects.toMatchObject({
      code: "TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(20_000);
    await timeoutExpectation;

    const controller = new AbortController();
    const cancelledRequest = api.health({ signal: controller.signal });
    const cancelledExpectation = expect(cancelledRequest).rejects.toSatisfy(
      (error) =>
        error instanceof ApiError && error.code === "REQUEST_CANCELLED",
    );
    controller.abort();
    await cancelledExpectation;
  });
});
