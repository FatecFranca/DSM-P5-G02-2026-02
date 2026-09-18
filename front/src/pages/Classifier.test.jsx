import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../lib/api.js";
import Classifier from "./Classifier.jsx";

vi.mock("../lib/api.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    api: {
      ...original.api,
      proposicoes: vi.fn(),
      proposicao: vi.fn(),
    },
  };
});

const proposal = {
  externalId: 123,
  source: "CAMARA",
  tipo: "PL",
  numero: 45,
  ano: 2026,
  ementa: "Altera a lei para ampliar o acesso à educação.",
  descricao: "Define os critérios oficiais para a ampliação prevista.",
  dataApresentacao: "2026-08-12T00:00:00.000Z",
  situacao: "Aguardando parecer",
  uri: "https://dadosabertos.camara.leg.br/api/v2/proposicoes/123",
  urlFonte: "https://www.camara.leg.br/propostas-legislativas/123",
  autores: [{ externalId: 1, nome: "Ana Silva", tipo: "Deputada" }],
  temasOficiais: [{ codTema: 46, tema: "Educação" }],
  fetchedAt: "2026-09-16T00:00:00.000Z",
};

describe("Classifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.proposicoes.mockResolvedValue({
      data: [proposal],
      pagination: { page: 1, total: 1, totalPages: 1 },
    });
    api.proposicao.mockResolvedValue({ data: proposal });
  });

  it("apresenta uma leitura rápida baseada apenas nos dados oficiais", async () => {
    const user = userEvent.setup();
    render(<Classifier />);

    await user.click(
      await screen.findByRole("button", { name: /Ver detalhes/i }),
    );

    const dialog = screen.getByRole("dialog", { name: "PL 45/2026" });
    expect(
      within(dialog).getByRole("heading", { name: "Leitura rápida" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Altera a lei para ampliar o acesso à educação.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Define os critérios oficiais para a ampliação prevista.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Detalhamento oficial da Câmara"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        /reorganiza os dados oficiais sem acrescentar interpretações/i,
      ),
    ).toBeInTheDocument();
  });

  it("não mantém proposições da Câmara quando a consulta do Senado falha", async () => {
    const user = userEvent.setup();
    api.proposicoes
      .mockResolvedValueOnce({
        data: [proposal],
        pagination: { page: 1, total: 1, totalPages: 1 },
      })
      .mockRejectedValueOnce(new Error("Consulta do Senado indisponível."));

    render(<Classifier />);
    expect(await screen.findByText(proposal.ementa)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Senado Federal" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Consulta do Senado indisponível.",
    );
    expect(screen.queryByText(proposal.ementa)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Senado Federal" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("não transforma uma URL insegura da API em link", async () => {
    const user = userEvent.setup();
    api.proposicoes.mockResolvedValueOnce({
      data: [{ ...proposal, urlFonte: "javascript:alert(1)" }],
      pagination: { page: 1, total: 1, totalPages: 1 },
    });
    api.proposicao.mockResolvedValueOnce({
      data: { ...proposal, urlFonte: "javascript:alert(1)" },
    });

    render(<Classifier />);
    await user.click(
      await screen.findByRole("button", { name: /Ver detalhes/i }),
    );

    expect(
      screen.queryByRole("link", { name: /Abrir na fonte oficial/i }),
    ).not.toBeInTheDocument();
  });

  it("substitui o resumo da lista pelo detalhe retornado pela API", async () => {
    const user = userEvent.setup();
    api.proposicao.mockResolvedValueOnce({
      data: {
        ...proposal,
        descricao: "Detalhe atualizado pela consulta individual.",
      },
    });

    render(<Classifier />);
    await user.click(
      await screen.findByRole("button", { name: /Ver detalhes/i }),
    );

    expect(
      await screen.findByText("Detalhe atualizado pela consulta individual."),
    ).toBeInTheDocument();
  });
});
