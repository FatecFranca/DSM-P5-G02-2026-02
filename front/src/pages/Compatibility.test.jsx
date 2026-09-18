import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Compatibility from "./Compatibility.jsx";

const mocks = vi.hoisted(() => ({
  temas: vi.fn(),
  compatibilidade: vi.fn(),
  deputado: vi.fn(),
  proposicoesDeputado: vi.fn(),
  estatisticas: vi.fn(),
  votacoes: vi.fn(),
  orgaos: vi.fn(),
  perfilTematico: vi.fn(),
}));

vi.mock("../lib/api.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    api: {
      ...original.api,
      ...mocks,
    },
  };
});

describe("Compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.temas.mockResolvedValue({ themes: [{ code: 46, name: "Educação" }] });
    mocks.compatibilidade.mockResolvedValue({
      period: { startYear: 2024, endYear: 2025 },
      themeSource: "official",
      summary: {
        profilesCompared: 500,
        parliamentariansConsidered: 513,
        documentsAnalyzed: 1000,
        coverage: 0.75,
        themesObserved: 20,
      },
      results: [
        {
          position: 1,
          parliamentarian: {
            id: 204549,
            name: "AJ Albuquerque",
            party: "PP",
            uf: "CE",
          },
          compatibilityPercent: 82,
          documentsAnalyzed: 20,
          matchedThemes: [
            {
              code: 46,
              name: "Educação",
              userWeight: 3,
              parliamentarianShare: 0.4,
            },
          ],
          evidence: [
            {
              proposalId: 123,
              themeCode: 46,
              title: "Amplia o acesso à educação básica",
              themeOrigin: "OFFICIAL",
            },
          ],
        },
      ],
    });
    mocks.deputado.mockResolvedValue({
      data: {
        externalId: 204549,
        nome: "AJ Albuquerque",
        nomeCivil: "Antônio José Albuquerque",
        partido: "PP",
        uf: "CE",
        email: "dep.ajalbuquerque@camara.leg.br",
        situacao: "Em exercício",
      },
    });
    mocks.proposicoesDeputado.mockResolvedValue({
      data: [
        {
          externalId: 123,
          source: "CAMARA",
          tipo: "PL",
          numero: 123,
          ano: 2024,
          ementa: "Amplia o acesso à educação básica.",
        },
      ],
    });
    mocks.estatisticas.mockResolvedValue({
      estatisticas: {
        proposicoes: 12,
        votacoes: 8,
        comissoesOrgaos: 3,
        temasDistintos: 4,
      },
      temas: [{ codTema: 46, tema: "Educação", quantidade: 5 }],
    });
    mocks.votacoes.mockResolvedValue({ data: [] });
    mocks.orgaos.mockResolvedValue({ data: [] });
    mocks.perfilTematico.mockResolvedValue({
      documentsAnalyzed: 20,
      coverage: 0.75,
      period: { startYear: 2023, endYear: 2025 },
      themes: [{ code: 46, name: "Educação", share: 0.4, documentCount: 8 }],
    });
  });

  it("abre a atuação completa a partir de um resultado temático", async () => {
    const user = userEvent.setup();
    render(
      <Compatibility
        themesProp={[
          {
            code: 46,
            name: "Educação",
            description: "Políticas públicas de ensino.",
            examples: ["Escolas", "Professores", "Estudantes"],
          },
        ]}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Tema 1"), "46");
    await user.clear(screen.getByLabelText("Ano inicial"));
    await user.type(screen.getByLabelText("Ano inicial"), "2024");
    await user.selectOptions(
      screen.getByLabelText("Fonte dos temas"),
      "official",
    );
    await user.click(
      screen.getByRole("button", { name: "Encontrar deputados" }),
    );

    expect(
      await screen.findByText("Amplia o acesso à educação básica"),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "Ver atuação completa de AJ Albuquerque",
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Antônio José Albuquerque")).toBeInTheDocument();
      expect(screen.getByText("PL 123/2024")).toBeInTheDocument();
    });
    expect(mocks.perfilTematico).toHaveBeenCalledWith(
      204549,
      expect.objectContaining({
        themeSource: "official",
        startYear: 2024,
        endYear: 2025,
      }),
      expect.any(Object),
    );
    expect(mocks.estatisticas).toHaveBeenCalledWith(
      "deputados",
      204549,
      "2024-01-01",
      "2025-12-31",
      expect.any(Object),
    );
    expect(
      screen.getByText(/perfil temático considera anos completos/i),
    ).toBeInTheDocument();
  });

  it("informa falha no catálogo e permite tentar novamente", async () => {
    const user = userEvent.setup();
    mocks.temas
      .mockRejectedValueOnce(new Error("Não foi possível carregar os temas."))
      .mockResolvedValueOnce({ themes: [{ code: 46, name: "Educação" }] });

    render(<Compatibility />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os temas.",
    );
    await user.click(
      screen.getByRole("button", { name: "Tentar carregar temas novamente" }),
    );
    expect(
      await screen.findByRole("option", { name: "Educação" }),
    ).toBeInTheDocument();
  });

  it("associa a validação ao primeiro campo inválido e move o foco", async () => {
    const user = userEvent.setup();
    render(<Compatibility themesProp={[{ code: 46, name: "Educação" }]} />);

    await user.click(
      screen.getByRole("button", { name: "Encontrar deputados" }),
    );

    const theme = screen.getByLabelText("Tema 1");
    expect(theme).toHaveFocus();
    expect(theme).toHaveAttribute("aria-invalid", "true");
    expect(theme).toHaveAccessibleDescription(
      "Escolha pelo menos um tema para encontrar deputados.",
    );
  });
});
