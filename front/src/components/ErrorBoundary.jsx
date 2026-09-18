import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    if (import.meta.env.DEV) {
      console.error("Falha inesperada de renderização:", error);
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;

    const reload = this.props.onReload || (() => window.location.reload());
    return (
      <main className="fatal-error" role="alert">
        <span className="eyebrow">Falha inesperada</span>
        <h1>A página encontrou um problema inesperado.</h1>
        <p>
          Recarregue a aplicação para tentar novamente. Nenhum dado foi
          alterado.
        </p>
        <button
          type="button"
          className="button button-primary"
          onClick={reload}
        >
          Recarregar aplicação
        </button>
      </main>
    );
  }
}
