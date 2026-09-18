import { useCallback, useEffect, useRef, useState } from "react";
import { api, extractList, isRequestCancelled } from "../lib/api.js";
import RepresentativeProfileModal from "../components/RepresentativeProfileModal.jsx";
import {
  EmptyState,
  ErrorBox,
  Icon,
  Loading,
  Pager,
} from "../components/Ui.jsx";
import { safeExternalUrl } from "../lib/presentation.js";

const LIMIT = 12;

function PersonCard({ person, house, onOpen }) {
  const [imageFailed, setImageFailed] = useState(false);
  const photoUrl = safeExternalUrl(person.fotoUrl);
  const initials = (person.nome || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <button
      type="button"
      className="person-card"
      onClick={() => onOpen(person)}
    >
      <span className="person-photo">
        {photoUrl && !imageFailed ? (
          <img
            src={photoUrl}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span>{initials}</span>
        )}
      </span>
      <span className="person-info">
        <small>
          {house === "deputados" ? "Deputado(a) federal" : "Senador(a)"}
        </small>
        <strong>{person.nome}</strong>
        <span>
          {person.partido || "Sem partido informado"} ·{" "}
          {person.uf || "UF não informada"}
        </span>
      </span>
      <span className="person-arrow">
        <Icon name="arrow" size={17} />
      </span>
    </button>
  );
}

export default function Parliamentarians() {
  const [house, setHouse] = useState("deputados");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const listRequest = useRef(0);
  const listAbort = useRef(null);

  const load = useCallback(async () => {
    const requestId = ++listRequest.current;
    listAbort.current?.abort();
    const controller = new AbortController();
    listAbort.current = controller;
    setLoading(true);
    setError("");
    setList([]);
    setPagination(null);
    try {
      const response =
        house === "deputados"
          ? await api.deputados(page, LIMIT, { signal: controller.signal })
          : await api.senadores(page, LIMIT, { signal: controller.signal });
      const parsed = extractList(response);
      if (requestId === listRequest.current) {
        setList(parsed.data);
        setPagination(parsed.pagination);
      }
    } catch (loadError) {
      if (requestId === listRequest.current && !isRequestCancelled(loadError)) {
        setError(loadError.message);
      }
    } finally {
      if (requestId === listRequest.current) setLoading(false);
    }
  }, [house, page]);

  useEffect(() => {
    load();
    return () => listAbort.current?.abort();
  }, [load]);

  function open(person) {
    setSelected(person);
  }

  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const visible = normalizedQuery
    ? list.filter((person) =>
        `${person.nome} ${person.partido} ${person.uf}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedQuery),
      )
    : list;

  return (
    <>
      <header className="page-intro">
        <span className="eyebrow">Pessoas e atuação</span>
        <h1>Conheça seus representantes</h1>
        <p>
          Consulte dados cadastrais, produção legislativa, votações nominais e
          participação em comissões e órgãos das duas Casas.
        </p>
      </header>

      <section className="source-switch" aria-label="Escolher Casa legislativa">
        <button
          type="button"
          className={house === "deputados" ? "active" : ""}
          aria-pressed={house === "deputados"}
          onClick={() => {
            setHouse("deputados");
            setPage(1);
            setQuery("");
          }}
        >
          Câmara dos Deputados
        </button>
        <button
          type="button"
          className={house === "senadores" ? "active" : ""}
          aria-pressed={house === "senadores"}
          onClick={() => {
            setHouse("senadores");
            setPage(1);
            setQuery("");
          }}
        >
          Senado Federal
        </button>
      </section>

      <div className="representative-toolbar">
        <label className="field field-search">
          <span>Filtrar nesta página</span>
          <span className="input-with-icon">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome, partido ou UF"
            />
          </span>
        </label>
        <div className="result-count">
          <strong>{pagination?.total?.toLocaleString("pt-BR") || "—"}</strong>
          <span>
            {house === "deputados" ? "deputados na base" : "senadores na base"}
          </span>
        </div>
      </div>

      <ErrorBox message={error} onRetry={load} />
      {loading ? (
        <Loading label="Carregando representantes" />
      ) : (
        <div className="people-grid">
          {visible.map((person) => (
            <PersonCard
              key={`${house}-${person.externalId}`}
              person={person}
              house={house}
              onOpen={open}
            />
          ))}
        </div>
      )}
      {!loading && !visible.length && !error && (
        <EmptyState title="Nenhum representante nesta página">
          Limpe o filtro ou avance pelas páginas da lista.
        </EmptyState>
      )}
      <Pager
        page={pagination?.page || page}
        totalPages={pagination?.totalPages}
        onChange={setPage}
      />

      {selected && (
        <RepresentativeProfileModal
          person={selected}
          house={house}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
