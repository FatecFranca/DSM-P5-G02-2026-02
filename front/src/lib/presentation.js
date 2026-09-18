const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const PERCENT_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});

export function formatDate(value) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  const parts = Object.fromEntries(
    DATE_FORMATTER.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.day} ${parts.month} ${parts.year}`;
}

export function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Não informado";
  }
  return PERCENT_FORMATTER.format(Math.min(1, Math.max(0, Number(value))));
}

export function toDisplayPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(100, Math.max(0, number));
}

export function safeExternalUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function getAvailableThemes(themes, picks, currentIndex) {
  const selectedElsewhere = new Set(
    picks
      .filter((_, index) => index !== currentIndex)
      .map((pick) => Number(pick.themeCode))
      .filter(Boolean),
  );
  return themes.filter((theme) => !selectedElsewhere.has(Number(theme.code)));
}

export function buildCompatibilityPayload({
  picks,
  limit,
  themeSource,
  startYear,
  endYear,
}) {
  const preferences = picks
    .filter((pick) => pick.themeCode)
    .map((pick) => ({
      themeCode: Number(pick.themeCode),
      weight: Number(pick.weight),
    }));
  const payload = {
    source: "CAMARA",
    themeSource,
    preferences,
    limit: Number(limit),
  };
  if (startYear && endYear) {
    payload.period = {
      startYear: Number(startYear),
      endYear: Number(endYear),
    };
  }
  return payload;
}

export function buildProposalReading(proposal = {}) {
  const summary = proposal.ementa?.trim() || proposal.descricao?.trim() || null;
  const description = proposal.descricao?.trim() || null;
  const detail =
    description?.toLocaleLowerCase("pt-BR") ===
    summary?.toLocaleLowerCase("pt-BR")
      ? null
      : description;

  return {
    summary,
    detail,
    detailLabel:
      proposal.source === "SENADO"
        ? "Explicação oficial do Senado"
        : "Detalhamento oficial da Câmara",
    status: proposal.situacao?.trim() || null,
    authors: (proposal.autores || [])
      .map((author) => author.nome?.trim())
      .filter(Boolean),
    themes: (proposal.temasOficiais || [])
      .map((theme) => theme.tema?.trim())
      .filter(Boolean),
  };
}

export function summarizeHealth(apiHealth, mlHealth) {
  return {
    api:
      apiHealth === null
        ? "checking"
        : apiHealth?.status === "ok"
          ? "online"
          : "offline",
    database:
      apiHealth === null
        ? "checking"
        : apiHealth?.database === "connected"
          ? "online"
          : apiHealth === false
            ? "offline"
            : apiHealth
              ? "offline"
              : "unknown",
    ml:
      mlHealth === null
        ? "checking"
        : mlHealth?.status === "ok" && mlHealth?.modelLoaded
          ? "online"
          : "offline",
  };
}
