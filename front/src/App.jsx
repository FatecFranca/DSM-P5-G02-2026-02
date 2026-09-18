import { useEffect, useRef, useState } from "react";
import { api } from "./lib/api.js";
import { summarizeHealth } from "./lib/presentation.js";
import { Icon, StatusPill } from "./components/Ui.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Classifier from "./pages/Classifier.jsx";
import Parliamentarians from "./pages/Parliamentarians.jsx";
import Themes from "./pages/Themes.jsx";
import Compatibility from "./pages/Compatibility.jsx";

const TABS = [
  {
    id: "inicio",
    label: "Início",
    title: "Panorama Legislativo | Congresso em dados",
  },
  {
    id: "proposicoes",
    label: "Proposições",
    title: "Proposições | Panorama Legislativo",
  },
  {
    id: "representantes",
    label: "Representantes",
    title: "Representantes | Panorama Legislativo",
  },
  { id: "temas", label: "Temas", title: "Temas | Panorama Legislativo" },
  {
    id: "afinidade",
    label: "Atuação por temas",
    title: "Atuação por temas | Panorama Legislativo",
  },
];
const TAB_IDS = new Set(TABS.map((tab) => tab.id));

function initialTab() {
  const hash = window.location.hash.replace("#/", "");
  return TAB_IDS.has(hash) ? hash : "inicio";
}

export default function App() {
  const [tab, setTab] = useState(initialTab);
  const [menuOpen, setMenuOpen] = useState(false);
  const [themes, setThemes] = useState([]);
  const [proposalQuery, setProposalQuery] = useState("");
  const [health, setHealth] = useState(() => summarizeHealth(null, null));
  const previousTab = useRef(tab);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      api.health({ signal: controller.signal }),
      api.mlHealth({ signal: controller.signal }),
      api.temas({ signal: controller.signal }),
    ]).then(([apiResult, mlResult, themesResult]) => {
      if (controller.signal.aborted) return;
      setHealth(
        summarizeHealth(
          apiResult.status === "fulfilled" ? apiResult.value : false,
          mlResult.status === "fulfilled" ? mlResult.value : false,
        ),
      );
      if (themesResult.status === "fulfilled") {
        setThemes(themesResult.value.themes || []);
      }
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    function syncHash() {
      const nextTab = initialTab();
      const hash = window.location.hash.replace("#/", "");
      if (!TAB_IDS.has(hash)) {
        window.history.replaceState(null, "", "#/inicio");
      }
      setTab(nextTab);
    }
    syncHash();
    const onHashChange = () => syncHash();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const current = TABS.find((item) => item.id === tab);
    document.title = current?.title || TABS[0].title;
    if (previousTab.current !== tab) {
      const heading = document.querySelector("#conteudo h1");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus({ preventScroll: true });
      const reduceMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      previousTab.current = tab;
    }
  }, [tab]);

  function navigate(nextTab) {
    setMenuOpen(false);
    window.location.hash = `/${nextTab}`;
  }

  function searchProposals(query) {
    setProposalQuery(query);
    navigate("proposicoes");
  }

  return (
    <>
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a
            href="#/inicio"
            className="brand"
            onClick={() => setMenuOpen(false)}
            aria-label="Panorama Legislativo, ir para o início"
          >
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>
              Panorama
              <small>Legislativo</small>
            </span>
          </a>

          <button
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            aria-controls="navegacao-principal"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? "close" : "menu"} />
          </button>

          <nav
            id="navegacao-principal"
            className={`main-nav ${menuOpen ? "nav-open" : ""}`}
            aria-label="Navegação principal"
          >
            {TABS.map((item) => (
              <a
                href={`#/${item.id}`}
                key={item.id}
                className={tab === item.id ? "active" : ""}
                aria-current={tab === item.id ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main id="conteudo" className="page-shell">
        {tab === "inicio" && (
          <Dashboard
            go={navigate}
            onSearch={searchProposals}
            themeCount={themes.length || 32}
          />
        )}
        {tab === "proposicoes" && <Classifier externalQuery={proposalQuery} />}
        {tab === "representantes" && <Parliamentarians />}
        {tab === "temas" && <Themes themesProp={themes} onLoaded={setThemes} />}
        {tab === "afinidade" && <Compatibility themesProp={themes} />}
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-statement">
            <span className="eyebrow light">
              Projeto acadêmico de interesse público
            </span>
            <h2>
              Informação legislativa para acompanhar, comparar e perguntar
              melhor.
            </h2>
            <p>
              Dados obtidos da Câmara dos Deputados e do Senado Federal. Sem
              vínculo partidário e sem recomendação de voto.
            </p>
          </div>
          <nav className="footer-nav" aria-label="Links do rodapé">
            <a href="#/proposicoes">Proposições</a>
            <a href="#/representantes">Representantes</a>
            <a href="#/afinidade">Atuação por temas</a>
          </nav>
        </div>
        <div
          className="service-status"
          aria-label="Disponibilidade dos serviços"
        >
          <StatusPill status={health.api}>
            {health.api === "checking"
              ? "Verificando API"
              : health.api === "online"
                ? "API disponível"
                : "API indisponível"}
          </StatusPill>
          <StatusPill status={health.database}>
            {health.database === "online"
              ? "Base conectada"
              : health.database === "checking"
                ? "Verificando base"
                : health.database === "unknown"
                  ? "Base não verificada"
                  : "Base desconectada"}
          </StatusPill>
          <StatusPill status={health.ml}>
            {health.ml === "checking"
              ? "Verificando modelo"
              : health.ml === "online"
                ? "Modelo disponível"
                : "Modelo indisponível"}
          </StatusPill>
        </div>
      </footer>
    </>
  );
}
