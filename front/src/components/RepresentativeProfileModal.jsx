import { useEffect, useRef, useState } from "react";

import { api, isRequestCancelled } from "../lib/api.js";
import {
  formatDate,
  formatPercent,
  safeExternalUrl,
} from "../lib/presentation.js";
import { Icon, Loading, Modal } from "./Ui.jsx";

const TODAY = new Date().toISOString().slice(0, 10);
const DEFAULT_START = `${new Date().getFullYear() - 3}-01-01`;

function getInitialPeriod(context) {
  if (context?.startYear && context?.endYear) {
    return {
      start: `${context.startYear}-01-01`,
      end: `${context.endYear}-12-31`,
    };
  }
  return { start: DEFAULT_START, end: TODAY };
}

export default function RepresentativeProfileModal({
  person,
  house,
  onClose,
  initialContext,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState(() => getInitialPeriod(initialContext));
  const [themeSource, setThemeSource] = useState(
    initialContext?.themeSource || "enriched",
  );
  const detailRequest = useRef(0);
  const detailAbort = useRef(null);
  const profileAbort = useRef(null);

  useEffect(() => {
    const initialPeriod = getInitialPeriod(initialContext);
    loadDetail(
      person,
      initialPeriod,
      initialContext?.themeSource || "enriched",
    );
    return () => {
      detailRequest.current += 1;
      detailAbort.current?.abort();
      profileAbort.current?.abort();
    };
  }, [house, initialContext, person]);

  async function loadDetail(nextPerson, nextPeriod, nextThemeSource) {
    const requestId = ++detailRequest.current;
    detailAbort.current?.abort();
    const controller = new AbortController();
    detailAbort.current = controller;
    setLoading(true);
    const id = nextPerson.externalId;
    const options = { signal: controller.signal };
    const baseRequest =
      house === "deputados"
        ? api.deputado(id, options)
        : api.senador(id, options);
    const proposalsRequest =
      house === "deputados"
        ? api.proposicoesDeputado(id, 1, 6, options)
        : api.proposicoesSenador(id, 1, 6, options);
    const requests = [
      baseRequest,
      proposalsRequest,
      api.estatisticas(house, id, nextPeriod.start, nextPeriod.end, options),
      api.votacoes(house, id, nextPeriod.start, nextPeriod.end, 1, 6, options),
      api.orgaos(house, id, nextPeriod.start, nextPeriod.end, 1, 6, options),
    ];
    if (house === "deputados") {
      requests.push(
        api.perfilTematico(
          id,
          {
            themeSource: nextThemeSource,
            startYear: Number(nextPeriod.start.slice(0, 4)),
            endYear: Number(nextPeriod.end.slice(0, 4)),
          },
          options,
        ),
      );
    }

    const [base, proposals, stats, votes, bodies, profile] =
      await Promise.allSettled(requests);
    if (requestId !== detailRequest.current || controller.signal.aborted)
      return;
    setDetail({
      base: valueOf(base)?.data || valueOf(base) || nextPerson,
      proposals: valueOf(proposals),
      stats: valueOf(stats),
      votes: valueOf(votes),
      bodies: valueOf(bodies),
      profile: valueOf(profile),
      warnings: [base, proposals, stats, votes, bodies, profile]
        .filter((result) => result?.status === "rejected")
        .map((result) => result.reason?.message)
        .filter(Boolean),
    });
    setLoading(false);
  }

  function close() {
    detailRequest.current += 1;
    detailAbort.current?.abort();
    profileAbort.current?.abort();
    onClose();
  }

  async function applyPeriod(event) {
    event.preventDefault();
    if (period.start > period.end) return;
    await loadDetail(person, period, themeSource);
  }

  async function changeThemeSource(nextSource) {
    setThemeSource(nextSource);
    profileAbort.current?.abort();
    const controller = new AbortController();
    profileAbort.current = controller;
    setLoading(true);
    try {
      const profile = await api.perfilTematico(
        person.externalId,
        {
          themeSource: nextSource,
          startYear: Number(period.start.slice(0, 4)),
          endYear: Number(period.end.slice(0, 4)),
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setDetail((current) => ({ ...current, profile }));
    } catch (profileError) {
      if (isRequestCancelled(profileError)) return;
      setDetail((current) => ({
        ...current,
        warnings: [...(current?.warnings || []), profileError.message],
      }));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  const titleId = `person-title-${person.externalId}`;

  return (
    <Modal titleId={titleId} onClose={close} className="person-modal">
      <div className="person-modal-hero">
        <div className="person-modal-title">
          <span className="eyebrow light">
            {house === "deputados" ? "Câmara dos Deputados" : "Senado Federal"}
          </span>
          <h2 id={titleId}>{person.nome}</h2>
          <p>
            {person.partido || "Partido não informado"} ·{" "}
            {person.uf || "UF não informada"}
          </p>
        </div>
        <button
          type="button"
          className="icon-button light"
          onClick={close}
          aria-label="Fechar perfil"
        >
          <Icon name="close" />
        </button>
      </div>

      {loading && <Loading label="Consultando atuação e indicadores" />}
      {!!detail?.warnings?.length && (
        <div className="partial-notice">
          Alguns conjuntos ainda não estão disponíveis para este período. Os
          dados carregados continuam abaixo.
        </div>
      )}

      {detail && (
        <div className="person-modal-body">
          <section className="profile-strip">
            <div>
              <span>Nome civil</span>
              <strong>{detail.base?.nomeCivil || "Não informado"}</strong>
            </div>
            <div>
              <span>Situação</span>
              <strong>{detail.base?.situacao || "Não informada"}</strong>
            </div>
            <div>
              <span>Contato institucional</span>
              <strong>{detail.base?.email || "Não informado"}</strong>
            </div>
            <div>
              <span>ID oficial</span>
              <strong>{person.externalId}</strong>
            </div>
          </section>

          <form className="period-form" onSubmit={applyPeriod}>
            <div>
              <span className="eyebrow">Recorte da atividade</span>
              <p>
                As contagens refletem somente dados sincronizados no período.
              </p>
            </div>
            <label className="field">
              <span>De</span>
              <input
                type="date"
                value={period.start}
                onChange={(event) =>
                  setPeriod((current) => ({
                    ...current,
                    start: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Até</span>
              <input
                type="date"
                value={period.end}
                onChange={(event) =>
                  setPeriod((current) => ({
                    ...current,
                    end: event.target.value,
                  }))
                }
              />
            </label>
            <button
              className="button button-primary"
              disabled={period.start > period.end}
            >
              Atualizar
            </button>
          </form>
          {house === "deputados" && (
            <p className="period-context-note">
              Os indicadores usam as datas exatas acima. O perfil temático
              considera anos completos, de {period.start.slice(0, 4)} a{" "}
              {period.end.slice(0, 4)}, conforme o contrato da API.
            </p>
          )}

          {detail.stats && (
            <section className="modal-section">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Indicadores objetivos</span>
                  <h3>Atividade no período</h3>
                </div>
              </div>
              <div className="metric-grid">
                <Metric
                  icon="file"
                  value={detail.stats.estatisticas?.proposicoes}
                  label="propostas"
                />
                <Metric
                  icon="vote"
                  value={detail.stats.estatisticas?.votacoes}
                  label="votações"
                />
                <Metric
                  icon="building"
                  value={detail.stats.estatisticas?.comissoesOrgaos}
                  label="órgãos"
                />
                <Metric
                  icon="book"
                  value={detail.stats.estatisticas?.temasDistintos}
                  label="temas distintos"
                />
              </div>
              {!!detail.stats.temas?.length && (
                <div className="topic-bars">
                  {detail.stats.temas.slice(0, 6).map((theme) => (
                    <div key={theme.codTema}>
                      <span>{theme.tema}</span>
                      <strong>{theme.quantidade}</strong>
                      <i>
                        <span
                          style={{
                            width: `${Math.min(100, (theme.quantidade / detail.stats.temas[0].quantidade) * 100)}%`,
                          }}
                        />
                      </i>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {house === "deputados" && detail.profile && (
            <section className="modal-section profile-section">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Perfil temático</span>
                  <h3>Onde concentra sua autoria ou coautoria</h3>
                </div>
                <select
                  aria-label="Fonte do perfil temático"
                  value={themeSource}
                  onChange={(event) => changeThemeSource(event.target.value)}
                >
                  <option value="enriched">
                    Oficiais + análise automática
                  </option>
                  <option value="official">Somente temas oficiais</option>
                </select>
              </div>
              <div className="coverage-line">
                <span>
                  {detail.profile.documentsAnalyzed} propostas analisadas
                </span>
                <span>{formatPercent(detail.profile.coverage)} com tema</span>
                <span>
                  {detail.profile.period?.startYear}–
                  {detail.profile.period?.endYear}
                </span>
              </div>
              <div className="profile-topics">
                {(detail.profile.themes || []).slice(0, 8).map((theme) => (
                  <div key={theme.code}>
                    <div>
                      <strong>{theme.name}</strong>
                      <span>{formatPercent(theme.share)}</span>
                    </div>
                    <i>
                      <span style={{ width: formatPercent(theme.share) }} />
                    </i>
                    <small>{theme.documentCount} propostas</small>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="detail-columns">
            <section className="modal-section">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Decisões nominais</span>
                  <h3>Votações registradas</h3>
                </div>
              </div>
              <div className="timeline-list">
                {(detail.votes?.data || []).map((vote) => (
                  <article key={vote.votacaoExternalId}>
                    <span className="timeline-dot" />
                    <div>
                      <strong>{vote.voto}</strong>
                      <span>{formatDate(vote.data)}</span>
                      <p>
                        {vote.descricao ||
                          vote.resultado ||
                          `Votação ${vote.votacaoExternalId}`}
                      </p>
                    </div>
                  </article>
                ))}
                {!(detail.votes?.data || []).length && (
                  <p className="muted">
                    Nenhuma votação sincronizada para o período.
                  </p>
                )}
              </div>
              {isTruncated(detail.votes) && (
                <p className="result-limit-note">
                  Exibindo {detail.votes.data.length} de{" "}
                  {detail.votes.pagination.total} votações.
                </p>
              )}
            </section>

            <section className="modal-section">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Participação institucional</span>
                  <h3>Órgãos e comissões</h3>
                </div>
              </div>
              <div className="body-list">
                {(detail.bodies?.data || []).map((body) => (
                  <article
                    key={`${body.orgaoExternalId}-${body.funcao}-${body.inicio}`}
                  >
                    <span>{body.sigla}</span>
                    <div>
                      <strong>{body.nome}</strong>
                      <p>
                        {body.funcao || "Função não informada"} · desde{" "}
                        {formatDate(body.inicio)}
                      </p>
                    </div>
                  </article>
                ))}
                {!(detail.bodies?.data || []).length && (
                  <p className="muted">
                    Nenhuma participação sincronizada para o período.
                  </p>
                )}
              </div>
              {isTruncated(detail.bodies) && (
                <p className="result-limit-note">
                  Exibindo {detail.bodies.data.length} de{" "}
                  {detail.bodies.pagination.total} participações.
                </p>
              )}
            </section>
          </div>

          <section className="modal-section">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">Produção legislativa</span>
                <h3>Propostas de autoria ou coautoria</h3>
              </div>
            </div>
            <div className="authored-list">
              {(detail.proposals?.data || []).map((proposal) => {
                const sourceUrl = safeExternalUrl(proposal.urlFonte);
                return (
                  <article key={`${proposal.source}-${proposal.externalId}`}>
                    <strong>
                      {proposal.tipo} {proposal.numero}/{proposal.ano}
                    </strong>
                    <p>
                      {proposal.ementa ||
                        proposal.descricao ||
                        "Resumo não informado."}
                    </p>
                    {sourceUrl && (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Fonte oficial <Icon name="external" size={15} />
                      </a>
                    )}
                  </article>
                );
              })}
              {!(detail.proposals?.data || []).length && (
                <p className="muted">
                  Nenhuma proposta sincronizada para este representante.
                </p>
              )}
            </div>
            {isTruncated(detail.proposals) && (
              <p className="result-limit-note">
                Exibindo {detail.proposals.data.length} de{" "}
                {detail.proposals.pagination.total} propostas.
              </p>
            )}
          </section>

          {house === "senadores" && (
            <div className="context-note">
              O perfil temático e a busca por atuação temática estão disponíveis
              apenas para deputados, pois o modelo atual usa a taxonomia oficial
              da Câmara.
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Metric({ icon, value, label }) {
  return (
    <div className="metric-card">
      <Icon name={icon} />
      <strong>{value ?? 0}</strong>
      <span>{label}</span>
    </div>
  );
}

function valueOf(result) {
  return result?.status === "fulfilled" ? result.value : null;
}

function isTruncated(result) {
  return Number(result?.pagination?.total) > (result?.data?.length || 0);
}
