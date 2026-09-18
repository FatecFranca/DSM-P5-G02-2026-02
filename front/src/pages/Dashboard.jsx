import { useCallback, useEffect, useRef, useState } from "react";
import { api, extractList, isRequestCancelled } from "../lib/api.js";
import { formatDate } from "../lib/presentation.js";
import { Card, ErrorBox, Icon, Loading } from "../components/Ui.jsx";

const INITIAL_STATS = {
  deputados: null,
  senadores: null,
  proposicoes: null,
};

export default function Dashboard({ go, onSearch, themeCount = 32 }) {
  const [stats, setStats] = useState(INITIAL_STATS);
  const [highlights, setHighlights] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef(null);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    const options = { signal: controller.signal };
    const results = await Promise.allSettled([
      api.deputados(1, 1, options),
      api.senadores(1, 1, options),
      api.proposicoes({ page: 1, limit: 3, source: "CAMARA" }, options),
      api.proposicoes({ page: 1, limit: 3, source: "SENADO" }, options),
    ]).then(([deputies, senators, chamber, senate]) => {
      if (controller.signal.aborted) return null;
      setStats({
        deputados:
          deputies.status === "fulfilled"
            ? deputies.value.pagination?.total
            : null,
        senadores:
          senators.status === "fulfilled"
            ? senators.value.pagination?.total
            : null,
        proposicoes:
          chamber.status === "fulfilled"
            ? chamber.value.pagination?.total
            : null,
      });
      const items = [chamber, senate]
        .filter((result) => result.status === "fulfilled")
        .flatMap((result) => extractList(result.value).data)
        .sort(
          (a, b) =>
            new Date(b.dataApresentacao || 0).getTime() -
            new Date(a.dataApresentacao || 0).getTime(),
        )
        .slice(0, 3);
      setHighlights(items);
      return [deputies, senators, chamber, senate];
    });
    if (!results || controller.signal.aborted) return;
    const failures = results.filter(
      (result) =>
        result.status === "rejected" && !isRequestCancelled(result.reason),
    );
    if (failures.length) {
      setError(
        "Parte da visão geral não pôde ser carregada. Os dados disponíveis continuam visíveis.",
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    return () => request.current?.abort();
  }, [load]);

  function submitSearch(event) {
    event.preventDefault();
    onSearch(query);
  }

  return (
    <>
      <section className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow light">Congresso Nacional em dados</span>
          <h1>Acompanhe quem decide e o que está em debate.</h1>
          <p>
            Projetos, votações, temas e atuação parlamentar reunidos em uma
            leitura pública, direta e sem jargão desnecessário.
          </p>
          <form className="hero-search" onSubmit={submitSearch}>
            <Icon name="search" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busque nesta página por educação, saúde..."
              aria-label="Buscar nas proposições da primeira página"
            />
            <button type="submit" className="button button-accent">
              Explorar
            </button>
          </form>
          <p className="search-note">
            A busca textual filtra a página consultada. Use ano e tipo para
            refinar.
          </p>
        </div>

        <div
          className="hemicycle"
          aria-label="Representação gráfica do plenário do Congresso"
        >
          <div className="hemicycle-caption">
            <span>Dados públicos</span>
            <strong>2 Casas</strong>
          </div>
          <div className="arc arc-one" />
          <div className="arc arc-two" />
          <div className="arc arc-three" />
          <div className="arc arc-four" />
          <div className="speaker-mark" />
        </div>
      </section>

      <section className="numbers-band" aria-label="Visão geral dos dados">
        <div>
          <span>Deputados na base</span>
          <strong>{formatNumber(stats.deputados)}</strong>
        </div>
        <div>
          <span>Senadores na base</span>
          <strong>{formatNumber(stats.senadores)}</strong>
        </div>
        <div>
          <span>Proposições da Câmara</span>
          <strong>{formatNumber(stats.proposicoes)}</strong>
        </div>
        <div>
          <span>Temas analisados</span>
          <strong>{themeCount}</strong>
        </div>
      </section>
      {loading && <Loading label="Carregando visão geral" />}
      <ErrorBox message={error} onRetry={load} />

      <section className="home-section">
        <div className="section-heading split-heading">
          <div>
            <span className="eyebrow">Comece por uma pergunta</span>
            <h2>O que você quer entender?</h2>
          </div>
          <p>
            Escolha um caminho e vá direto aos dados que respondem à sua dúvida.
          </p>
        </div>
        <div className="journey-grid">
          <button
            type="button"
            className="journey-card journey-blue"
            onClick={() => go("proposicoes")}
          >
            <span className="journey-icon">
              <Icon name="file" />
            </span>
            <span className="journey-number">01</span>
            <strong>O que está sendo proposto?</strong>
            <span>
              Leia e filtre os resumos oficiais de projetos da Câmara e do
              Senado.
            </span>
            <span className="journey-link">
              Ver proposições <Icon name="arrow" size={16} />
            </span>
          </button>
          <button
            type="button"
            className="journey-card journey-green"
            onClick={() => go("representantes")}
          >
            <span className="journey-icon">
              <Icon name="people" />
            </span>
            <span className="journey-number">02</span>
            <strong>Como atua meu representante?</strong>
            <span>
              Consulte autoria, temas, votos e participação em órgãos.
            </span>
            <span className="journey-link">
              Conhecer representantes <Icon name="arrow" size={16} />
            </span>
          </button>
          <button
            type="button"
            className="journey-card journey-yellow"
            onClick={() => go("afinidade")}
          >
            <span className="journey-icon">
              <Icon name="compass" />
            </span>
            <span className="journey-number">03</span>
            <strong>Quem atua nos temas que importam?</strong>
            <span>
              Escolha assuntos e veja quais deputados concentram atuação nesses
              temas.
            </span>
            <span className="journey-link">
              Explorar atuação por temas <Icon name="arrow" size={16} />
            </span>
          </button>
        </div>
      </section>

      {!!highlights.length && (
        <section className="home-section">
          <div className="section-heading split-heading">
            <div>
              <span className="eyebrow">Registros recentes</span>
              <h2>Na base legislativa</h2>
            </div>
            <button
              type="button"
              className="text-link"
              onClick={() => go("proposicoes")}
            >
              Consultar todas <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="highlight-list">
            {highlights.map((proposal, index) => (
              <Card
                key={`${proposal.source}-${proposal.externalId}`}
                className="highlight-item"
              >
                <span className="highlight-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="meta-row">
                    <span
                      className={`source-badge source-${proposal.source.toLowerCase()}`}
                    >
                      {proposal.source === "CAMARA" ? "Câmara" : "Senado"}
                    </span>
                    <span>{formatDate(proposal.dataApresentacao)}</span>
                  </div>
                  <h3>
                    {proposal.tipo} {proposal.numero}/{proposal.ano}
                  </h3>
                  <p className="line-clamp">
                    {proposal.ementa ||
                      proposal.descricao ||
                      "Resumo não informado."}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="method-banner">
        <div className="method-icon">
          <Icon name="database" size={28} />
        </div>
        <div>
          <span className="eyebrow">De onde vêm os dados</span>
          <h2>Fontes oficiais, método visível.</h2>
          <p>
            Cadastros, proposições, votos e órgãos vêm das bases da Câmara e do
            Senado. A inteligência artificial complementa a classificação
            temática da Câmara e nunca transforma similaridade em recomendação
            eleitoral.
          </p>
        </div>
        <button
          type="button"
          className="button button-light"
          onClick={() => go("temas")}
        >
          Entender os temas
        </button>
      </section>
    </>
  );
}

function formatNumber(value) {
  return typeof value === "number" ? value.toLocaleString("pt-BR") : "—";
}
