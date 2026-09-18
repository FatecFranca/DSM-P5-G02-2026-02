import { useCallback, useEffect, useRef, useState } from "react";
import { api, isRequestCancelled } from "../lib/api.js";
import {
  buildCompatibilityPayload,
  formatPercent,
  getAvailableThemes,
  toDisplayPercent,
} from "../lib/presentation.js";
import { ErrorBox, Icon, Loading } from "../components/Ui.jsx";
import RepresentativeProfileModal from "../components/RepresentativeProfileModal.jsx";

let nextPickId = 1;
const createPick = () => ({ id: nextPickId++, themeCode: "", weight: 3 });
const EMPTY_THEMES = [];

export default function Compatibility({ themesProp = EMPTY_THEMES }) {
  const [themes, setThemes] = useState(themesProp);
  const [picks, setPicks] = useState(() => [createPick()]);
  const [limit, setLimit] = useState(5);
  const [themeSource, setThemeSource] = useState("enriched");
  const [startYear, setStartYear] = useState("2023");
  const [endYear, setEndYear] = useState("2025");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [themesLoading, setThemesLoading] = useState(!themesProp.length);
  const [themesError, setThemesError] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const themesAbort = useRef(null);
  const submitAbort = useRef(null);

  const loadThemes = useCallback(async () => {
    themesAbort.current?.abort();
    const controller = new AbortController();
    themesAbort.current = controller;
    setThemesLoading(true);
    setThemesError("");
    try {
      const response = await api.temas({ signal: controller.signal });
      if (!controller.signal.aborted) setThemes(response.themes || []);
    } catch (loadError) {
      if (!isRequestCancelled(loadError)) setThemesError(loadError.message);
    } finally {
      if (!controller.signal.aborted) setThemesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (themesProp.length) {
      themesAbort.current?.abort();
      setThemes(themesProp);
      setThemesError("");
      setThemesLoading(false);
      return undefined;
    }
    loadThemes();
    return () => {
      themesAbort.current?.abort();
    };
  }, [loadThemes, themesProp]);

  useEffect(() => () => submitAbort.current?.abort(), []);

  function updatePick(index, patch) {
    setInvalidField("");
    setError("");
    setResult(null);
    setPicks((current) =>
      current.map((pick, pickIndex) =>
        pickIndex === index ? { ...pick, ...patch } : pick,
      ),
    );
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    if (!picks.some((pick) => pick.themeCode)) {
      setError("Escolha pelo menos um tema para encontrar deputados.");
      setInvalidField("theme");
      document.getElementById("preference-theme-0")?.focus();
      return;
    }
    if (Number(startYear) > Number(endYear)) {
      setError("O ano inicial precisa ser menor ou igual ao ano final.");
      setInvalidField("period");
      document.getElementById("compatibility-start-year")?.focus();
      return;
    }
    submitAbort.current?.abort();
    const controller = new AbortController();
    submitAbort.current = controller;
    setInvalidField("");
    setLoading(true);
    try {
      const payload = buildCompatibilityPayload({
        picks,
        limit,
        themeSource,
        startYear,
        endYear,
      });
      setResult(
        await api.compatibilidade(payload, { signal: controller.signal }),
      );
    } catch (submitError) {
      if (!isRequestCancelled(submitError)) setError(submitError.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return (
    <>
      <header className="page-intro affinity-intro">
        <span className="eyebrow">Atuação por temas</span>
        <h1>Veja quem atua nos assuntos do seu interesse</h1>
        <p>
          Escolha temas e encontre deputados cujas propostas registradas se
          concentram nesses assuntos.
        </p>
      </header>

      <div className="affinity-layout">
        <form className="affinity-form" onSubmit={submit}>
          <section className="affinity-step">
            <span className="step-number">1</span>
            <div className="step-content">
              <div className="step-heading">
                <div>
                  <h2>Escolha temas de interesse</h2>
                  <p>Selecione até 10 temas sem repetição.</p>
                </div>
                <span>
                  {picks.filter((pick) => pick.themeCode).length}/10 escolhidos
                </span>
              </div>
              <div className="preference-list">
                {picks.map((pick, index) => (
                  <div className="preference-row" key={pick.id}>
                    <label className="field">
                      <span>Tema {index + 1}</span>
                      <select
                        id={`preference-theme-${index}`}
                        name={`preference-theme-${index}`}
                        autoComplete="off"
                        value={pick.themeCode}
                        aria-invalid={invalidField === "theme" && index === 0}
                        aria-describedby={
                          invalidField === "theme" && index === 0
                            ? "compatibility-field-error"
                            : undefined
                        }
                        onChange={(event) =>
                          updatePick(index, { themeCode: event.target.value })
                        }
                      >
                        <option value="">Escolha um assunto</option>
                        {getAvailableThemes(themes, picks, index).map(
                          (theme) => (
                            <option key={theme.code} value={theme.code}>
                              {theme.name}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label className="field weight-field">
                      <span>Importância</span>
                      <select
                        name={`preference-weight-${index}`}
                        autoComplete="off"
                        value={pick.weight}
                        onChange={(event) =>
                          updatePick(index, { weight: event.target.value })
                        }
                      >
                        <option value="1">1 · menor</option>
                        <option value="2">2</option>
                        <option value="3">3 · média</option>
                        <option value="4">4</option>
                        <option value="5">5 · máxima</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="icon-button remove-preference"
                      disabled={picks.length === 1}
                      onClick={() =>
                        setPicks((current) =>
                          current.filter((_, pickIndex) => pickIndex !== index),
                        )
                      }
                      aria-label={`Remover tema ${index + 1}`}
                    >
                      <Icon name="close" size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="text-link add-theme"
                disabled={
                  themesLoading ||
                  picks.length >= 10 ||
                  picks.length >= themes.length
                }
                onClick={() =>
                  setPicks((current) => [...current, createPick()])
                }
              >
                <span>+</span> Adicionar outro tema
              </button>
              {themesLoading && (
                <Loading label="Carregando temas disponíveis" />
              )}
              <ErrorBox
                message={themesError}
                onRetry={loadThemes}
                retryLabel="Tentar carregar temas novamente"
              />
            </div>
          </section>

          <section className="affinity-step">
            <span className="step-number">2</span>
            <div className="step-content">
              <div className="step-heading">
                <div>
                  <h2>Defina o recorte</h2>
                  <p>Consulte perfis produzidos para um mesmo período.</p>
                </div>
              </div>
              <div className="period-grid">
                <label className="field">
                  <span>Ano inicial</span>
                  <input
                    id="compatibility-start-year"
                    name="start-year"
                    autoComplete="off"
                    type="number"
                    min="1900"
                    max="2100"
                    value={startYear}
                    aria-invalid={invalidField === "period"}
                    aria-describedby={
                      invalidField === "period"
                        ? "compatibility-field-error"
                        : undefined
                    }
                    onChange={(event) => {
                      setStartYear(event.target.value);
                      setResult(null);
                      setInvalidField("");
                    }}
                    required
                  />
                </label>
                <label className="field">
                  <span>Ano final</span>
                  <input
                    name="end-year"
                    autoComplete="off"
                    type="number"
                    min="1900"
                    max="2100"
                    value={endYear}
                    aria-invalid={invalidField === "period"}
                    aria-describedby={
                      invalidField === "period"
                        ? "compatibility-field-error"
                        : undefined
                    }
                    onChange={(event) => {
                      setEndYear(event.target.value);
                      setResult(null);
                      setInvalidField("");
                    }}
                    required
                  />
                </label>
                <label className="field">
                  <span>Fonte dos temas</span>
                  <select
                    name="theme-source"
                    autoComplete="off"
                    value={themeSource}
                    onChange={(event) => {
                      setThemeSource(event.target.value);
                      setResult(null);
                    }}
                  >
                    <option value="enriched">
                      Oficiais + análise automática
                    </option>
                    <option value="official">Somente oficiais</option>
                  </select>
                </label>
                <label className="field">
                  <span>Quantidade de resultados</span>
                  <select
                    name="result-limit"
                    autoComplete="off"
                    value={limit}
                    onChange={(event) => {
                      setLimit(event.target.value);
                      setResult(null);
                    }}
                  >
                    {[3, 5, 10, 15, 20].map((value) => (
                      <option key={value} value={value}>
                        {value} deputados
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </section>

          <ErrorBox id="compatibility-error" message={error} />
          {invalidField && (
            <span id="compatibility-field-error" className="sr-only">
              {error}
            </span>
          )}
          <button
            className="button button-accent affinity-submit"
            disabled={loading}
          >
            <Icon name="compass" />{" "}
            {loading ? "Buscando atuação..." : "Encontrar deputados"}
          </button>
        </form>

        <aside className="affinity-aside">
          <span className="eyebrow light">Como interpretar</span>
          <h2>Uma busca baseada em registros.</h2>
          <p>
            A proximidade considera a frequência dos temas nas propostas de
            autoria ou coautoria. Não mede qualidade, ideologia ou concordância
            em votos.
          </p>
          <dl>
            <div>
              <dt>Universo</dt>
              <dd>Deputados federais</dd>
            </div>
            <div>
              <dt>Método</dt>
              <dd>Similaridade de cosseno</dd>
            </div>
            <div>
              <dt>Evidência</dt>
              <dd>Propostas de autoria ou coautoria</dd>
            </div>
          </dl>
        </aside>
      </div>

      {loading && <Loading label="Consultando perfis temáticos" />}
      {result && (
        <section className="ranking-section" aria-live="polite">
          <div className="ranking-header">
            <div>
              <span className="eyebrow">Resultado da busca</span>
              <h2>Deputados com maior proximidade temática</h2>
              <p>
                {result.period?.startYear}–{result.period?.endYear} ·{" "}
                {result.themeSource === "enriched"
                  ? "temas oficiais e automáticos"
                  : "somente temas oficiais"}
              </p>
            </div>
            <div className="ranking-summary">
              <strong>
                {result.summary?.profilesCompared?.toLocaleString("pt-BR") || 0}
              </strong>
              <span>perfis analisados</span>
            </div>
          </div>

          <div className="summary-grid">
            <div>
              <strong>{result.summary?.parliamentariansConsidered || 0}</strong>
              <span>deputados considerados</span>
            </div>
            <div>
              <strong>
                {result.summary?.documentsAnalyzed?.toLocaleString("pt-BR") ||
                  0}
              </strong>
              <span>proposições analisadas</span>
            </div>
            <div>
              <strong>{formatPercent(result.summary?.coverage)}</strong>
              <span>cobertura temática</span>
            </div>
            <div>
              <strong>{result.summary?.themesObserved || 0}</strong>
              <span>temas observados</span>
            </div>
          </div>

          <div className="ranking-list">
            {(result.results || []).map((item) => (
              <article className="ranking-card" key={item.parliamentarian.id}>
                <div className="rank-position">
                  <span>#</span>
                  {item.position}
                </div>
                <div className="rank-main">
                  <div className="rank-title">
                    <div>
                      <h3>{item.parliamentarian.name}</h3>
                      <p>
                        {item.parliamentarian.party || "Partido não informado"}{" "}
                        · {item.parliamentarian.uf || "UF não informada"} ·{" "}
                        {item.documentsAnalyzed} proposições
                      </p>
                    </div>
                    <div className="rank-score">
                      <strong>
                        {toDisplayPercent(item.compatibilityPercent)}%
                      </strong>
                      <span>proximidade temática</span>
                    </div>
                  </div>
                  <div className="score-bar">
                    <span
                      style={{
                        width: `${toDisplayPercent(item.compatibilityPercent)}%`,
                      }}
                    />
                  </div>
                  <div className="matched-themes">
                    {(item.matchedThemes || []).map((theme) => (
                      <div key={theme.code}>
                        <strong>{theme.name}</strong>
                        <span>
                          peso {theme.userWeight} ·{" "}
                          {formatPercent(theme.parliamentarianShare)} da atuação
                          temática
                        </span>
                      </div>
                    ))}
                  </div>
                  {!!item.evidence?.length && (
                    <details className="evidence-box">
                      <summary>
                        Ver evidências usadas ({item.evidence.length})
                      </summary>
                      {item.evidence.map((evidence) => (
                        <article
                          key={`${evidence.proposalId}-${evidence.themeCode}`}
                        >
                          <span className="source-badge source-camara">
                            {evidence.themeOrigin === "OFFICIAL"
                              ? "Tema oficial"
                              : "Tema por IA"}
                          </span>
                          <strong>{evidence.title}</strong>
                          <small>
                            Proposição {evidence.proposalId}
                            {evidence.modelName
                              ? ` · ${evidence.modelName}`
                              : ""}
                          </small>
                        </article>
                      ))}
                    </details>
                  )}
                  <button
                    type="button"
                    className="button button-primary button-small rank-profile-button"
                    aria-label={`Ver atuação completa de ${item.parliamentarian.name}`}
                    onClick={() =>
                      setSelected({
                        person: {
                          externalId: item.parliamentarian.id,
                          nome: item.parliamentarian.name,
                          partido: item.parliamentarian.party,
                          uf: item.parliamentarian.uf,
                        },
                        context: {
                          startYear: result.period?.startYear,
                          endYear: result.period?.endYear,
                          themeSource: result.themeSource,
                        },
                      })
                    }
                  >
                    Ver atuação completa <Icon name="arrow" size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!(result.results || []).length && (
            <p className="context-note">
              Nenhum perfil com temas suficientes foi encontrado para este
              recorte.
            </p>
          )}
        </section>
      )}

      {selected && (
        <RepresentativeProfileModal
          person={selected.person}
          house="deputados"
          initialContext={selected.context}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
