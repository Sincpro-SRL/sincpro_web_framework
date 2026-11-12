import {
  BoundedContext,
  Command,
  memoryTransport,
  servicesWith,
  type Transport,
} from "@sincpro/client-framework";
import { FrameworkProvider, ServiceButton, textOf, useRecord } from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { servidorVentas } from "./support/servidor";
import { facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/48 · Una acción es un caso de uso",
  parameters: {
    docs: {
      description: {
        component:
          "Una acción de la aplicación es un **caso de uso** de su bounded context — su lógica, su span `<contexto>/<Servicio>`, su pedido llevando la traza al servidor —, nunca un pedido que arma la pantalla. `ServiceButton` lo corre con el mismo gesto que `CommandButton`: se apaga mientras corre, y un rechazo se muestra donde pasó, con qué hacer. Una acción que destruye pregunta primero (`rehearse`: el mismo caso de uso en seco) y muestra **lo que haría**, en palabras del servidor — esa es la confirmación, no un «¿estás seguro?».",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

type VentasDependencies = { transport: Transport };
type Answer = { number: string; state: string };

const { Feature } = servicesWith<VentasDependencies>();

/** Annul an invoice — or only say what it would do (`dry_run`). */
class CommandCancelInvoice extends Command<
  Answer | { text: string; data: Record<string, unknown> }
> {
  constructor(
    readonly number: string,
    readonly dry_run = false,
  ) {
    super();
  }
}

class CommandConfirmInvoice extends Command<Answer> {
  constructor(readonly number: string) {
    super();
  }
}

class CancelInvoice extends Feature<
  CommandCancelInvoice,
  Answer | { text: string; data: Record<string, unknown> }
> {
  execute(command: CommandCancelInvoice) {
    return this.transport.send<Answer | { text: string; data: Record<string, unknown> }>(
      "POST",
      `/facturas/${command.number}/cancel`,
      { dry_run: command.dry_run },
    );
  }
}

class ConfirmInvoice extends Feature<CommandConfirmInvoice, Answer> {
  execute(command: CommandConfirmInvoice) {
    return this.transport.send<Answer>("POST", `/facturas/${command.number}/confirm`, {});
  }
}

function application() {
  const servidor = servidorVentas();
  const screens = memoryTransport(servidor.tables, { handle: servidor.handle, latency: 60 });
  const ventasBoundedContext = new BoundedContext<VentasDependencies>("ventas");
  ventasBoundedContext.addDependency(
    "transport",
    memoryTransport(servidor.tables, { handle: servidor.handle, latency: 60 }),
  );
  ventasBoundedContext.feature(CommandCancelInvoice)(CancelInvoice);
  ventasBoundedContext.feature(CommandConfirmInvoice)(ConfirmInvoice);
  return {
    screens,
    cancel: (number: string) =>
      ventasBoundedContext.execute(new CommandCancelInvoice(number)) as Promise<Answer>,
    rehearseCancel: (number: string) =>
      ventasBoundedContext.execute(new CommandCancelInvoice(number, true)) as Promise<{
        text: string;
        data: Record<string, unknown>;
      }>,
    confirm: (number: string) =>
      ventasBoundedContext.execute(new CommandConfirmInvoice(number)),
  };
}

type Application = ReturnType<typeof application>;

/** A draft (i = 0) and a posted one (i = 1). */
const BORRADOR = "F-2026-0001";
const PUBLICADA = "F-2026-0002";

function Invoice({ number, app }: { number: string; app: Application }) {
  const invoice = useRecord(facturas, number);
  const state =
    invoice.status === "ready"
      ? (textOf(invoice.meta, "state", invoice.record.state) ?? invoice.record.state)
      : "…";
  return (
    <div className="flex items-center gap-3">
      <p className="text-meta">
        {number}: {state}
      </p>
      <ServiceButton label="Confirmar" run={() => app.confirm(number)} />
      <ServiceButton
        label="Anular"
        run={() => app.cancel(number)}
        rehearse={() => app.rehearseCancel(number)}
      />
    </div>
  );
}

function Screen({ number }: { number: string }) {
  const app = useMemo(application, []);
  return (
    <FrameworkProvider transport={app.screens} entities={[facturas]}>
      <div className="p-4">
        <Invoice number={number} app={app} />
      </div>
    </FrameworkProvider>
  );
}

export const LoQueDestruyePreguntaPrimeroLoQueHaria: Story = {
  render: () => <Screen number={BORRADOR} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await expect(await canvas.findByText(`${BORRADOR}: Borrador`)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Anular" }));
    // The use case run dry says what would happen — in the server's words —, and nothing yet did.
    await expect(await page.findByText(/queda anulada: su total/)).toBeInTheDocument();
    await expect(canvas.getByText(`${BORRADOR}: Borrador`)).toBeVisible();
    await userEvent.click(await page.findByRole("button", { name: "Hacerlo" }));
    await expect(await canvas.findByText(`${BORRADOR}: Anulada`)).toBeVisible();
    await waitFor(() => expect(page.queryByText(/queda anulada: su total/)).toBeNull());
  },
};

export const UnRechazoSeMuestraDondePaso: Story = {
  render: () => <Screen number={PUBLICADA} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await expect(await canvas.findByText(`${PUBLICADA}: Publicada`)).toBeVisible();
    // Undoable: it runs on the click. The server refuses it, and says why, where it happened.
    await userEvent.click(canvas.getByRole("button", { name: "Confirmar" }));
    await expect(await page.findByText("Ya está confirmada")).toBeInTheDocument();
    await expect(canvas.getByText(`${PUBLICADA}: Publicada`)).toBeVisible();
  },
};
