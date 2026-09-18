import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Modal } from "./Ui.jsx";

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir detalhes
      </button>
      {open && (
        <Modal titleId="modal-title" onClose={() => setOpen(false)}>
          <h2 id="modal-title">Detalhes</h2>
          <button type="button">Ação secundária</button>
          <button type="button" onClick={() => setOpen(false)}>
            Fechar
          </button>
        </Modal>
      )}
    </div>
  );
}

describe("Modal", () => {
  it("mantém o foco dentro do diálogo e o devolve ao acionador", async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    const opener = screen.getByRole("button", { name: "Abrir detalhes" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Detalhes" });
    const secondary = screen.getByRole("button", { name: "Ação secundária" });
    const close = screen.getByRole("button", { name: "Fechar" });

    expect(dialog).toContainElement(document.activeElement);

    close.focus();
    await user.tab();
    expect(secondary).toHaveFocus();

    secondary.focus();
    await user.tab({ shift: true });
    expect(close).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
