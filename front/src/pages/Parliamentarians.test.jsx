import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../lib/api.js";
import Parliamentarians from "./Parliamentarians.jsx";

vi.mock("../lib/api.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    api: {
      ...original.api,
      deputados: vi.fn(),
      senadores: vi.fn(),
    },
  };
});

const page = (person) => ({
  data: person ? [person] : [],
  pagination: { page: 1, limit: 12, total: person ? 1 : 0, totalPages: 1 },
});

describe("Parliamentarians", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.deputados.mockResolvedValue(
      page({ externalId: 1, nome: "Deputada Ana", partido: "ABC", uf: "SP" }),
    );
    api.senadores.mockRejectedValueOnce(
      new Error("Não foi possível carregar os senadores."),
    );
  });

  it("remove a lista anterior após falha e recupera a Casa selecionada", async () => {
    const user = userEvent.setup();
    render(<Parliamentarians />);

    expect(await screen.findByText("Deputada Ana")).toBeInTheDocument();
    const senateButton = screen.getByRole("button", { name: "Senado Federal" });
    await user.click(senateButton);

    expect(senateButton).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os senadores.",
    );
    expect(screen.queryByText("Deputada Ana")).not.toBeInTheDocument();

    api.senadores.mockResolvedValueOnce(
      page({ externalId: 2, nome: "Senador Bruno", partido: "XYZ", uf: "MG" }),
    );
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Senador Bruno")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("não carrega uma foto com URL insegura recebida da API", async () => {
    api.deputados.mockResolvedValueOnce(
      page({
        externalId: 3,
        nome: "Deputada Carla",
        partido: "ABC",
        uf: "RJ",
        fotoUrl: "javascript:alert(1)",
      }),
    );

    render(<Parliamentarians />);

    expect(await screen.findByText("Deputada Carla")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("DC")).toBeInTheDocument();
  });
});
