import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../lib/api.js";
import Dashboard from "./Dashboard.jsx";

vi.mock("../lib/api.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    api: {
      ...original.api,
      deputados: vi.fn(),
      senadores: vi.fn(),
      proposicoes: vi.fn(),
    },
  };
});

const emptyPage = {
  data: [],
  pagination: { page: 1, limit: 1, total: 10, totalPages: 10 },
};

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.deputados.mockResolvedValue(emptyPage);
    api.senadores.mockRejectedValueOnce(
      new Error("Serviço temporariamente indisponível"),
    );
    api.proposicoes.mockResolvedValue(emptyPage);
  });

  it("expõe falha parcial e permite tentar novamente sem ocultar os dados válidos", async () => {
    const user = userEvent.setup();
    render(<Dashboard go={vi.fn()} onSearch={vi.fn()} themeCount={32} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Carregando visão geral",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Parte da visão geral não pôde ser carregada.",
    );
    expect(screen.getAllByText("10")).toHaveLength(2);

    api.senadores.mockResolvedValueOnce(emptyPage);
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Senadores na base")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
