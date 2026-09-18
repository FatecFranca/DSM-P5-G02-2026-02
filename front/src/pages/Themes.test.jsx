import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../lib/api.js";
import Themes from "./Themes.jsx";

vi.mock("../lib/api.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    api: { ...original.api, temas: vi.fn() },
  };
});

describe("Themes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("abre a explicação do tema em um diálogo que pode ser fechado", async () => {
    const user = userEvent.setup();
    render(
      <Themes
        themesProp={[
          {
            code: 46,
            name: "Educação",
            description:
              "Trata das políticas públicas de ensino e do acesso à aprendizagem em todas as etapas da vida.",
            examples: [
              "Financiamento de escolas e universidades",
              "Formação e carreira de professores",
              "Acesso e permanência de estudantes",
            ],
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Entender tema Educação" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Educação" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Trata das políticas públicas de ensino/),
    ).toHaveLength(2);
    expect(
      screen.getByText("Financiamento de escolas e universidades"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Formação e carreira de professores"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fechar explicação" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("avisa quando a API ainda não oferece a explicação do tema", async () => {
    const user = userEvent.setup();
    render(<Themes themesProp={[{ code: 46, name: "Educação" }]} />);

    await user.click(
      screen.getByRole("button", { name: "Entender tema Educação" }),
    );

    expect(screen.getByRole("dialog", { name: "Educação" })).toHaveTextContent(
      "A explicação deste tema não está disponível nesta versão da API.",
    );
  });

  it("permite repetir o carregamento depois de uma falha", async () => {
    const user = userEvent.setup();
    api.temas
      .mockRejectedValueOnce(new Error("Catálogo indisponível."))
      .mockResolvedValueOnce({ themes: [{ code: 46, name: "Educação" }] });

    render(<Themes />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Catálogo indisponível.",
    );
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByRole("button", { name: "Entender tema Educação" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
