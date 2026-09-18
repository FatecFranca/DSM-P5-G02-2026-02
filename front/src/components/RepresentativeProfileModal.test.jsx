import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../lib/api.js";
import RepresentativeProfileModal from "./RepresentativeProfileModal.jsx";

vi.mock("../lib/api.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    api: {
      ...original.api,
      deputado: vi.fn(),
      proposicoesDeputado: vi.fn(),
      estatisticas: vi.fn(),
      votacoes: vi.fn(),
      orgaos: vi.fn(),
      perfilTematico: vi.fn(),
    },
  };
});

const person = {
  externalId: 42,
  nome: "Deputada Ana",
  partido: "ABC",
  uf: "SP",
};

describe("RepresentativeProfileModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.deputado.mockResolvedValue({
      data: { ...person, nomeCivil: "Ana da Silva" },
    });
    api.proposicoesDeputado.mockResolvedValue({
      data: [
        {
          source: "CAMARA",
          externalId: 10,
          tipo: "PL",
          numero: 10,
          ano: 2026,
          ementa: "Proposta de teste",
          urlFonte: "javascript:alert(1)",
        },
      ],
      pagination: { total: 8 },
    });
    api.estatisticas.mockResolvedValue({
      estatisticas: {
        proposicoes: 8,
        votacoes: 9,
        comissoesOrgaos: 7,
        temasDistintos: 1,
      },
      temas: [],
    });
    api.votacoes.mockResolvedValue({
      data: [
        {
          votacaoExternalId: 20,
          voto: "Sim",
          data: "2026-08-01",
          descricao: "Votação nominal",
        },
      ],
      pagination: { total: 9 },
    });
    api.orgaos.mockResolvedValue({
      data: [
        {
          orgaoExternalId: 30,
          sigla: "CCJ",
          nome: "Comissão",
          funcao: "Titular",
          inicio: "2026-01-01",
        },
      ],
      pagination: { total: 7 },
    });
    api.perfilTematico.mockResolvedValue({
      documentsAnalyzed: 8,
      coverage: 1,
      period: { startYear: 2023, endYear: 2026 },
      themes: [],
    });
  });

  it("informa quando as listas exibem apenas uma amostra dos registros", async () => {
    render(
      <RepresentativeProfileModal
        person={person}
        house="deputados"
        onClose={vi.fn()}
      />,
    );

    expect(
      await screen.findByText("Exibindo 1 de 9 votações."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Exibindo 1 de 7 participações."),
    ).toBeInTheDocument();
    expect(screen.getByText("Exibindo 1 de 8 propostas.")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Fonte oficial/i }),
    ).not.toBeInTheDocument();
  });
});
