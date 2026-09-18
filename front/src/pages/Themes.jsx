import { useCallback, useEffect, useRef, useState } from "react";
import { api, isRequestCancelled } from "../lib/api.js";
import {
  EmptyState,
  ErrorBox,
  Icon,
  Loading,
  Modal,
} from "../components/Ui.jsx";

const EMPTY_THEMES = [];

export default function Themes({ themesProp = EMPTY_THEMES, onLoaded }) {
  const [themes, setThemes] = useState(themesProp);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(!themesProp.length);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const request = useRef(null);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await api.temas({ signal: controller.signal });
      if (controller.signal.aborted) return;
      const loadedThemes = response.themes || [];
      setThemes(loadedThemes);
      if (loadedThemes.length) onLoaded?.(loadedThemes);
    } catch (loadError) {
      if (!isRequestCancelled(loadError)) setError(loadError.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [onLoaded]);

  useEffect(() => {
    if (themesProp.length) {
      request.current?.abort();
      setThemes(themesProp);
      setError("");
      setLoading(false);
      return undefined;
    }
    load();
    return () => request.current?.abort();
  }, [load, themesProp]);

  const normalized = filter.trim().toLocaleLowerCase("pt-BR");
  const filtered = themes.filter((theme) =>
    `${theme.code} ${theme.name} ${theme.description} ${(theme.examples || []).join(" ")}`
      .toLocaleLowerCase("pt-BR")
      .includes(normalized),
  );

  return (
    <>
      <header className="page-intro themes-intro">
        <span className="eyebrow">Vocabulário legislativo</span>
        <h1>32 assuntos para entender o debate</h1>
        <p>
          Esta é a taxonomia oficial da Câmara usada para organizar proposições,
          compor perfis de atuação e apoiar a busca por temas.
        </p>
      </header>

      <section className="themes-search">
        <label className="field field-search">
          <span>Encontrar um tema</span>
          <span className="input-with-icon">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Ex.: educação, saúde, meio ambiente"
            />
          </span>
        </label>
        <div>
          <strong>{filtered.length}</strong>
          <span>tema(s) visível(is)</span>
        </div>
      </section>

      <ErrorBox message={error} onRetry={load} />
      {loading ? (
        <Loading label="Carregando temas oficiais" />
      ) : (
        <section className="themes-grid" aria-label="Catálogo de temas">
          {filtered.map((theme, index) => (
            <button
              type="button"
              className={`theme-card theme-color-${index % 4}`}
              key={theme.code}
              aria-label={`Entender tema ${theme.name}`}
              onClick={() => setSelected({ theme, colorIndex: index % 4 })}
            >
              <span className="theme-code">
                {String(theme.code).padStart(2, "0")}
              </span>
              <strong className="theme-name">{theme.name}</strong>
              <span className="theme-summary">
                {theme.description ||
                  "Explicação indisponível nesta versão da API."}
              </span>
              <span className="theme-card-footer">
                <span className="theme-line" />
                <span>
                  Entender <Icon name="arrow" size={15} />
                </span>
              </span>
            </button>
          ))}
        </section>
      )}
      {!loading && !filtered.length && !error && (
        <EmptyState title="Nenhum tema encontrado">
          Tente uma palavra mais curta ou pesquise pelo código oficial.
        </EmptyState>
      )}

      {selected && (
        <Modal
          titleId="theme-explainer-title"
          onClose={() => setSelected(null)}
          className={`theme-explainer theme-color-${selected.colorIndex}`}
        >
          <header className="theme-explainer-header">
            <div>
              <span className="theme-code">
                Tema {String(selected.theme.code).padStart(2, "0")}
              </span>
              <h2 id="theme-explainer-title">{selected.theme.name}</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => setSelected(null)}
              aria-label="Fechar explicação"
            >
              <Icon name="close" />
            </button>
          </header>
          {selected.theme.description && selected.theme.examples?.length ? (
            <>
              <h3 className="theme-explainer-label">
                O que este tema significa
              </h3>
              <p className="theme-explainer-lead">
                {selected.theme.description}
              </p>
              <h3 className="theme-explainer-label examples">
                Exemplos de assuntos
              </h3>
              <div className="theme-examples-grid">
                {selected.theme.examples.map((example) => (
                  <article key={example}>
                    <span>
                      <Icon name="check" size={17} />
                    </span>
                    <strong>{example}</strong>
                  </article>
                ))}
              </div>
              <p className="theme-editorial-note">
                Os exemplos são ilustrativos. Uma proposição pode tratar de mais
                de um tema, e a classificação não indica posição favorável ou
                contrária.
              </p>
            </>
          ) : (
            <p className="partial-notice">
              A explicação deste tema não está disponível nesta versão da API.
            </p>
          )}
        </Modal>
      )}

      <section className="taxonomy-note">
        <Icon name="book" size={26} />
        <div>
          <strong>Um vocabulário comum</strong>
          <p>
            Os códigos preservam a referência da fonte oficial. Uma mesma
            proposição pode ter mais de um tema, por isso as distribuições não
            representam posições favoráveis ou contrárias.
          </p>
        </div>
      </section>
    </>
  );
}
