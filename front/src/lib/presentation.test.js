import { describe, expect, it } from "vitest";
import {
  buildCompatibilityPayload,
  buildProposalReading,
  formatDate,
  formatPercent,
  getAvailableThemes,
  safeExternalUrl,
  toDisplayPercent,
  summarizeHealth,
} from "./presentation.js";

describe("presentation helpers", () => {
  it("formata datas oficiais sem deslocar o dia por fuso horário", () => {
    expect(formatDate("2026-08-12T00:00:00.000Z")).toBe("12 ago. 2026");
    expect(formatDate(null)).toBe("Não informado");
  });

  it("formata proporções como percentuais públicos", () => {
    expect(formatPercent(2 / 3)).toBe("67%");
    expect(formatPercent(null)).toBe("Não informado");
    expect(formatPercent(2)).toBe("100%");
    expect(toDisplayPercent(120)).toBe(100);
    expect(toDisplayPercent(-4)).toBe(0);
    expect(toDisplayPercent("inválido")).toBe(0);
  });

  it("aceita somente URLs externas HTTP ou HTTPS", () => {
    expect(safeExternalUrl("https://www.camara.leg.br/proposta/1")).toBe(
      "https://www.camara.leg.br/proposta/1",
    );
    expect(safeExternalUrl("http://www25.senado.leg.br/materia/1")).toBe(
      "http://www25.senado.leg.br/materia/1",
    );
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,unsafe")).toBeNull();
    expect(safeExternalUrl("not a url")).toBeNull();
  });

  it("remove das opções os temas já escolhidos em outras linhas", () => {
    const themes = [
      { code: 40, name: "Educação" },
      { code: 46, name: "Meio ambiente" },
      { code: 62, name: "Saúde" },
    ];
    const picks = [
      { themeCode: "40", weight: 5 },
      { themeCode: "46", weight: 3 },
    ];

    expect(
      getAvailableThemes(themes, picks, 1).map((theme) => theme.code),
    ).toEqual([46, 62]);
  });

  it("monta o payload de afinidade com período e números estritos", () => {
    expect(
      buildCompatibilityPayload({
        picks: [{ themeCode: "46", weight: "5" }],
        limit: "10",
        themeSource: "enriched",
        startYear: "2023",
        endYear: "2025",
      }),
    ).toEqual({
      source: "CAMARA",
      period: { startYear: 2023, endYear: 2025 },
      themeSource: "enriched",
      preferences: [{ themeCode: 46, weight: 5 }],
      limit: 10,
    });
  });

  it("diferencia API, banco e modelo no resumo de disponibilidade", () => {
    expect(
      summarizeHealth(
        { status: "ok", database: "connected" },
        { status: "ok", modelLoaded: true },
      ),
    ).toEqual({ api: "online", database: "online", ml: "online" });

    expect(summarizeHealth(null, null)).toEqual({
      api: "checking",
      database: "checking",
      ml: "checking",
    });

    expect(summarizeHealth(false, false)).toEqual({
      api: "offline",
      database: "offline",
      ml: "offline",
    });
  });

  it("organiza os campos oficiais da proposição sem alterar seu conteúdo", () => {
    expect(
      buildProposalReading({
        source: "CAMARA",
        ementa: "  Altera a lei para ampliar o acesso à educação.  ",
        descricao: "Define os critérios oficiais para a ampliação prevista.",
        situacao: "Aguardando parecer",
        autores: [{ nome: "Ana Silva" }, { nome: "Bruno Souza" }],
        temasOficiais: [{ tema: "Educação" }, { tema: "Direitos Humanos" }],
      }),
    ).toEqual({
      summary: "Altera a lei para ampliar o acesso à educação.",
      detail: "Define os critérios oficiais para a ampliação prevista.",
      detailLabel: "Detalhamento oficial da Câmara",
      status: "Aguardando parecer",
      authors: ["Ana Silva", "Bruno Souza"],
      themes: ["Educação", "Direitos Humanos"],
    });
  });

  it("não repete a ementa como detalhamento nem inventa dados ausentes", () => {
    expect(
      buildProposalReading({
        source: "SENADO",
        ementa: "Institui uma política nacional.",
        descricao: " Institui uma política nacional. ",
        autores: [],
        temasOficiais: [],
      }),
    ).toEqual({
      summary: "Institui uma política nacional.",
      detail: null,
      detailLabel: "Explicação oficial do Senado",
      status: null,
      authors: [],
      themes: [],
    });
  });
});
