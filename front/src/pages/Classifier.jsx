import { useCallback, useEffect, useRef, useState } from "react";
import { api, extractList, isRequestCancelled } from "../lib/api.js";
import {
  buildProposalReading,
  formatDate,
  safeExternalUrl,
} from "../lib/presentation.js";
import {
  Card,
  EmptyState,
  ErrorBox,
  Icon,
  Loading,
  Modal,
  Pager,
} from "../components/Ui.jsx";

const PAGE_SIZE = 10;

function normalize(value) {
  return (value || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function Classifier({ externalQuery }) {
  const [filters, setFilters] = useState({
    ano: "",
    tipo: "",
    source: "CAMARA",
  });
  const [query, setQuery] = useState(externalQuery || "");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [predictionError, setPredictionError] = useState("");
  const [predicting, setPredicting] = useState(false);
  const listRequest = useRef(0);
  const detailRequest = useRef(0);
  const listAbort = useRef(null);
  const detailAbort = useRef(null);
  const predictionAbort = useRef(null);

  useEffect(() => {
    setQuery(externalQuery || "");
    setPage(1);
  }, [externalQuery]);

  const load = useCallback(async () => {
    const requestId = ++listRequest.current;
    listAbort.current?.abort();
    const controller = new AbortController();
    listAbort.current = controller;
    setLoading(true);
    setError("");
    setItems([]);
    setPagination(null);
    try {
      const response = await api.proposicoes(
        {
          page,
          limit: PAGE_SIZE,
          ano: filters.ano || undefined,
          tipo: filters.tipo.trim() || undefined,
          source: filters.source,
        },
        { signal: controller.signal },
      );
      const list = extractList(response);
      if (requestId === listRequest.current) {
        setItems(list.data);
        setPagination(list.pagination);
      }
    } catch (loadError) {
      if (requestId === listRequest.current && !isRequestCancelled(loadError)) {
        setError(loadError.message);
      }
    } finally {
      if (requestId === listRequest.current) setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
    return () => listAbort.current?.abort();
  }, [load]);

  async function openDetail(proposal) {
    const requestId = ++detailRequest.current;
    detailAbort.current?.abort();
    const controller = new AbortController();
    detailAbort.current = controller;
    setDetail({ data: proposal });
    setDetailLoading(true);
    try {
      const response = await api.proposicao(
        proposal.externalId,
        proposal.source,
        {
          signal: controller.signal,
        },
      );
      if (requestId === detailRequest.current && !controller.signal.aborted) {
        setDetail({ data: response?.data || response });
      }
    } catch (detailError) {
      if (requestId === detailRequest.current) {
        setDetail({ data: proposal, error: detailError.message });
      }
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false);
    }
  }

  function closeDetail() {
    detailRequest.current += 1;
    detailAbort.current?.abort();
    setDetail(null);
    setDetailLoading(false);
  }

  async function analyzeText(event) {
    event.preventDefault();
    if (!analysisText.trim()) return;
    setPredicting(true);
    predictionAbort.current?.abort();
    const controller = new AbortController();
    predictionAbort.current = controller;
    setPrediction(null);
    setPredictionError("");
    try {
      setPrediction(
        await api.predict(analysisText.trim(), { signal: controller.signal }),
      );
    } catch (predictError) {
      if (!isRequestCancelled(predictError))
        setPredictionError(predictError.message);
    } finally {
      if (!controller.signal.aborted) setPredicting(false);
    }
  }

  const normalizedQuery = normalize(query.trim());
  const visibleItems = normalizedQuery
    ? items.filter((proposal) =>
        normalize(
          `${proposal.tipo} ${proposal.numero} ${proposal.ano} ${proposal.ementa} ${proposal.descricao} ${(proposal.autores || []).map((author) => author.nome).join(" ")}`,
        ).includes(normalizedQuery),
      )
    : items;
  const detailReading = detail ? buildProposalReading(detail.data) : null;
  const detailSourceUrl = safeExternalUrl(detail?.data?.urlFonte);

  return (
    <>
      <header className="page-intro">
        <span className="eyebrow">Consulta legislativa</span>
        <h1>Propostas em linguagem direta</h1>
        <p>
          Consulte ementas oficiais da Câmara e do Senado. Uma ementa resume o
          objetivo de uma proposta, mas não substitui a leitura do texto
          integral.
        </p>
      </header>

      <section className="source-switch" aria-label="Escolher Casa legislativa">
        <button
          type="button"
          className={filters.source === "CAMARA" ? "active" : ""}
          aria-pressed={filters.source === "CAMARA"}
          onClick={() => {
            setFilters((current) => ({ ...current, source: "CAMARA" }));
            setPage(1);
          }}
        >
          Câmara dos Deputados
        </button>
        <button
          type="button"
          className={filters.source === "SENADO" ? "active" : ""}
          aria-pressed={filters.source === "SENADO"}
          onClick={() => {
            setFilters((current) => ({ ...current, source: "SENADO" }));
            setPage(1);
          }}
        >
          Senado Federal
        </button>
      </section>

      <Card className="filter-panel">
        <div className="filter-grid proposal-filters">
          <label className="field field-search">
            <span>Buscar nesta página</span>
            <span className="input-with-icon">
              <Icon name="search" size={18} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Palavra, número ou autoria"
              />
            </span>
          </label>
          <label className="field">
            <span>Ano</span>
            <input
              type="number"
              inputMode="numeric"
              min="1900"
              max="2100"
              value={filters.ano}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  ano: event.target.value,
                }));
                setPage(1);
              }}
              placeholder="2025"
            />
          </label>
          <label className="field">
            <span>Tipo</span>
            <input
              value={filters.tipo}
              maxLength={20}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  tipo: event.target.value,
                }));
                setPage(1);
              }}
              placeholder="PL, PEC, MPV"
            />
          </label>
        </div>
        <div className="filter-footnote">
          <span>
            {pagination?.total?.toLocaleString("pt-BR") || "—"} registros nesta
            consulta
          </span>
          <span>
            A busca por palavra considera os {PAGE_SIZE} resultados da página
            atual.
          </span>
        </div>
      </Card>

      <section className="analysis-disclosure">
        <button
          type="button"
          onClick={() => setAnalysisOpen((open) => !open)}
          aria-expanded={analysisOpen}
        >
          <span className="analysis-icon">
            <Icon name="sparkle" />
          </span>
          <span>
            <strong>Analisar um texto por tema</strong>
            <small>
              Use o modelo experimental treinado com dados da Câmara
            </small>
          </span>
          <Icon name="arrow" className={analysisOpen ? "rotate" : ""} />
        </button>
        {analysisOpen && (
          <form className="analysis-form" onSubmit={analyzeText}>
            <label className="field">
              <span>Texto para análise</span>
              <textarea
                value={analysisText}
                onChange={(event) => setAnalysisText(event.target.value)}
                maxLength={5000}
                placeholder="Cole uma ementa, proposta ou trecho de notícia..."
              />
            </label>
            <div className="form-actions">
              <span>
                {analysisText.length.toLocaleString("pt-BR")} / 5.000 caracteres
              </span>
              <button
                className="button button-primary"
                disabled={!analysisText.trim() || predicting}
              >
                {predicting ? "Analisando..." : "Identificar temas"}
              </button>
            </div>
            <ErrorBox message={predictionError} />
            {prediction && (
              <div className="prediction-result" aria-live="polite">
                <div>
                  <span className="eyebrow">Resultado experimental</span>
                  <strong>
                    {prediction.labelCount || 0} tema(s) identificado(s)
                  </strong>
                </div>
                <div className="tag-list">
                  {(prediction.labels || []).map((label) => (
                    <span className="theme-tag theme-tag-ai" key={label.code}>
                      <Icon name="sparkle" size={14} /> {label.name}
                    </span>
                  ))}
                  {!prediction.labelCount && (
                    <span>Nenhum tema superou o limite do modelo.</span>
                  )}
                </div>
                <p>
                  A margem técnica não é probabilidade. Modelo{" "}
                  {prediction.model?.name || "não informado"}, versão{" "}
                  {prediction.model?.version || "não informada"}.
                </p>
              </div>
            )}
          </form>
        )}
      </section>

      <section className="results-section" aria-live="polite">
        <div className="results-heading">
          <h2>Resultados</h2>
          <span>Página {pagination?.page || page}</span>
        </div>
        <ErrorBox message={error} onRetry={load} />
        {loading ? (
          <Loading label="Carregando proposições" />
        ) : (
          <div className="proposal-list">
            {visibleItems.map((proposal) => (
              <article
                className="proposal-item"
                key={`${proposal.source}-${proposal.externalId}`}
              >
                <div className="proposal-rail">
                  <span>{proposal.tipo}</span>
                  <strong>{proposal.numero}</strong>
                  <small>{proposal.ano}</small>
                </div>
                <div className="proposal-content">
                  <div className="meta-row">
                    <span
                      className={`source-badge source-${proposal.source.toLowerCase()}`}
                    >
                      {proposal.source === "CAMARA" ? "Câmara" : "Senado"}
                    </span>
                    <span>{formatDate(proposal.dataApresentacao)}</span>
                    {proposal.situacao && <span>{proposal.situacao}</span>}
                  </div>
                  <h3>
                    {proposal.ementa ||
                      proposal.descricao ||
                      "Ementa não informada"}
                  </h3>
                  {!!proposal.autores?.length && (
                    <p className="byline">
                      Autoria:{" "}
                      {proposal.autores
                        .slice(0, 3)
                        .map((author) => author.nome)
                        .join(", ")}
                      {proposal.autores.length > 3
                        ? ` e mais ${proposal.autores.length - 3}`
                        : ""}
                    </p>
                  )}
                  {!!proposal.temasOficiais?.length && (
                    <div className="tag-list">
                      {proposal.temasOficiais.map((theme) => (
                        <span className="theme-tag" key={theme.codTema}>
                          {theme.tema}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => openDetail(proposal)}
                  >
                    Ver detalhes <Icon name="arrow" size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {!loading && !visibleItems.length && !error && (
          <EmptyState title="Nenhuma proposição nesta página">
            Remova a busca local ou ajuste o ano e o tipo consultados.
          </EmptyState>
        )}
        <Pager
          page={pagination?.page || page}
          totalPages={pagination?.totalPages}
          onChange={setPage}
        />
      </section>

      {detail && (
        <Modal titleId="proposal-title" onClose={closeDetail}>
          <div className="modal-header">
            <div>
              <span className="eyebrow">Detalhe da proposição</span>
              <h2 id="proposal-title">
                {detail.data.tipo} {detail.data.numero}/{detail.data.ano}
              </h2>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={closeDetail}
              aria-label="Fechar detalhes"
            >
              <Icon name="close" />
            </button>
          </div>
          {detailLoading && <Loading label="Atualizando detalhes" />}
          <ErrorBox message={detail.error} />
          <section
            className="proposal-reading"
            aria-labelledby="proposal-reading-title"
          >
            <div className="proposal-reading-header">
              <span className="eyebrow">Dados em ordem direta</span>
              <h3 id="proposal-reading-title">Leitura rápida</h3>
              <p>
                Esta leitura reorganiza os dados oficiais sem acrescentar
                interpretações.
              </p>
            </div>
            <div className="proposal-reading-grid">
              <article className="proposal-reading-main">
                <strong>Em resumo</strong>
                <p>
                  {detailReading.summary || "Não informado pela fonte oficial."}
                </p>
              </article>
              {detailReading.detail && (
                <article className="proposal-reading-main">
                  <strong>{detailReading.detailLabel}</strong>
                  <p>{detailReading.detail}</p>
                </article>
              )}
              <article>
                <strong>Situação agora</strong>
                <p>
                  {detailReading.status || "Não informada pela fonte oficial."}
                </p>
              </article>
              <article>
                <strong>Quem apresentou</strong>
                <p>
                  {detailReading.authors.join(", ") ||
                    "Não informado pela fonte oficial."}
                </p>
              </article>
              <article>
                <strong>Assuntos relacionados</strong>
                <p>
                  {detailReading.themes.join(", ") ||
                    "Não informados pela fonte oficial."}
                </p>
              </article>
            </div>
          </section>
          <dl className="data-grid">
            <div>
              <dt>Casa</dt>
              <dd>
                {detail.data.source === "CAMARA"
                  ? "Câmara dos Deputados"
                  : "Senado Federal"}
              </dd>
            </div>
            <div>
              <dt>Apresentação</dt>
              <dd>{formatDate(detail.data.dataApresentacao)}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{detail.data.situacao || "Não informada"}</dd>
            </div>
            <div>
              <dt>ID oficial</dt>
              <dd>{detail.data.externalId}</dd>
            </div>
          </dl>
          {!!detail.data.autores?.length && (
            <section className="modal-section">
              <h3>Autoria</h3>
              <div className="plain-list">
                {detail.data.autores.map((author, index) => (
                  <div key={`${author.externalId || author.nome}-${index}`}>
                    <strong>{author.nome}</strong>
                    <span>{author.tipo}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {!!detail.data.temasOficiais?.length && (
            <section className="modal-section">
              <h3>Temas oficiais</h3>
              <div className="tag-list">
                {detail.data.temasOficiais.map((theme) => (
                  <span className="theme-tag" key={theme.codTema}>
                    {theme.tema}
                  </span>
                ))}
              </div>
            </section>
          )}
          {detailSourceUrl && (
            <a
              className="button button-primary external-button"
              href={detailSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir na fonte oficial <Icon name="external" size={17} />
            </a>
          )}
        </Modal>
      )}
    </>
  );
}
