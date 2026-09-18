import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { api } from "./lib/api.js";

vi.mock("./lib/api.js", () => ({
  API_URL: "http://127.0.0.1:3000",
  extractList: (payload) => ({
    data: payload?.data || [],
    pagination: payload?.pagination || null,
  }),
  api: {
    health: vi.fn(),
    mlHealth: vi.fn(),
    temas: vi.fn(),
    deputados: vi.fn(),
    senadores: vi.fn(),
    proposicoes: vi.fn(),
  },
}));

describe("portal público", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "#/inicio");
    api.health.mockResolvedValue({ status: "ok", database: "connected" });
    api.mlHealth.mockResolvedValue({
      status: "ok",
      modelLoaded: true,
      modelName: "linear_svc_balanced",
      modelVersion: "experimental-1",
      classes: 32,
    });
    api.temas.mockResolvedValue({ count: 32, themes: [] });
    api.deputados.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 1, total: 513, totalPages: 513 },
    });
    api.senadores.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 1, total: 81, totalPages: 81 },
    });
    api.proposicoes.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 3, total: 231410, totalPages: 77137 },
    });
  });

  it("expõe as áreas do produto em linguagem voltada ao cidadão", () => {
    render(<App />);

    const navigation = within(
      screen.getByRole("navigation", { name: "Navegação principal" }),
    );
    expect(
      navigation.getByRole("link", { name: "Proposições" }),
    ).toHaveAttribute("href", "#/proposicoes");
    expect(
      navigation.getByRole("link", { name: "Representantes" }),
    ).toBeInTheDocument();
    expect(
      navigation.getByRole("link", { name: "Atuação por temas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /acompanhe quem decide/i }),
    ).toBeInTheDocument();
  });

  it("mostra separadamente a disponibilidade da API, dos dados e da IA", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("API disponível")).toBeInTheDocument();
      expect(screen.getByText("Base conectada")).toBeInTheDocument();
      expect(screen.getByText("Modelo disponível")).toBeInTheDocument();
    });
  });

  it("mostra verificação antes de confirmar indisponibilidade", async () => {
    let rejectHealth;
    let rejectMl;
    api.health.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectHealth = reject;
      }),
    );
    api.mlHealth.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectMl = reject;
      }),
    );

    render(<App />);

    expect(screen.getByText("Verificando API")).toBeInTheDocument();
    expect(screen.getByText("Verificando modelo")).toBeInTheDocument();
    rejectHealth(new Error("offline"));
    rejectMl(new Error("offline"));

    expect(await screen.findByText("API indisponível")).toBeInTheDocument();
    expect(screen.getByText("Modelo indisponível")).toBeInTheDocument();
  });

  it("navega com hash, atualiza título e leva foco ao título da página", async () => {
    const user = userEvent.setup();
    render(<App />);

    const navigation = within(
      screen.getByRole("navigation", { name: "Navegação principal" }),
    );
    await user.click(navigation.getByRole("link", { name: "Temas" }));
    const heading = await screen.findByRole("heading", {
      name: /32 assuntos para entender/i,
    });

    await waitFor(() => expect(window.location.hash).toBe("#/temas"));
    expect(document.title).toBe("Temas | Panorama Legislativo");
    expect(heading).toHaveFocus();
  });

  it("marca o link ativo da navegação com estado de página atual", async () => {
    const user = userEvent.setup();
    render(<App />);

    const navigation = within(
      screen.getByRole("navigation", { name: "Navegação principal" }),
    );
    await user.click(navigation.getByRole("link", { name: "Temas" }));

    const activeLink = navigation.getByRole("link", { name: "Temas" });
    await waitFor(() =>
      expect(activeLink).toHaveAttribute("aria-current", "page"),
    );
    expect(activeLink).toHaveClass("active");
    expect(
      navigation.getByRole("link", { name: "Início" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("normaliza hash inválido e acompanha Back e Forward", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "#/nao-existe");
    render(<App />);

    await waitFor(() => expect(window.location.hash).toBe("#/inicio"));
    const navigation = within(
      screen.getByRole("navigation", { name: "Navegação principal" }),
    );
    await user.click(navigation.getByRole("link", { name: "Temas" }));
    await screen.findByRole("heading", { name: /32 assuntos para entender/i });

    window.history.back();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /acompanhe quem decide/i }),
      ).toBeInTheDocument();
    });

    window.history.forward();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /32 assuntos para entender/i }),
      ).toBeInTheDocument();
    });
  });
});
