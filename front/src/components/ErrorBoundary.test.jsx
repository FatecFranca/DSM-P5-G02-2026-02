import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ErrorBoundary from "./ErrorBoundary.jsx";

function BrokenView() {
  throw new Error("detalhe técnico");
}

describe("ErrorBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("substitui uma falha inesperada por recuperação amigável", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    const reload = vi.fn();

    render(
      <ErrorBoundary onReload={reload}>
        <BrokenView />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "A página encontrou um problema inesperado.",
    );
    expect(screen.queryByText("detalhe técnico")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Recarregar aplicação" }),
    );
    expect(reload).toHaveBeenCalledOnce();
  });
});
