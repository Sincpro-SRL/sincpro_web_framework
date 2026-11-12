import {
  BoundedContext,
  Command,
  memoryTransport,
  processChanges,
  servicesWith,
  type Transport,
} from "@sincpro/client-framework";
import {
  cachedTransport,
  EntityList,
  FrameworkProvider,
  ServiceButton,
  textOf,
  useListing,
  useRecord,
} from "@sincpro/web-framework";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { servidorVentas } from "./support/servidor";
import { facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/47 · Lo que otro escribió se ve",
  parameters: {
    docs: {
      description: {
        component:
          "Una pantalla muestra lo que es cierto **ahora**, escriba quien escriba: su propio guardado, un caso de uso corrido desde un botón, un panel al lado. Cada escritura que manda un transporte del framework se anuncia en el **feed de cambios** del proceso (`processChanges`, @sincpro/client-framework) — también la de un caso de uso que escribe por su propio cliente, que no es el transporte de las pantallas. Las lecturas en pantalla (`useListing`, `useRecord`, `useHistory`, los grupos, el pivot, los nombres) lo siguen y se vuelven a leer cuando una escritura toca lo que muestran, conservando su filtro, su orden y lo que se estaba escribiendo; el cache olvida lo que la escritura tocó (`<SincproApp>` lo conecta solo). Nadie llama `reload()` a mano.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** What the use cases of «ventas» count on: their OWN transport — as a generated client is. */
type VentasDependencies = { transport: Transport };

const { Feature } = servicesWith<VentasDependencies>();

class CommandConfirmInvoice extends Command<{ number: string; state: string }> {
  constructor(readonly number: string) {
    super();
  }
}

class ConfirmInvoice extends Feature<
  CommandConfirmInvoice,
  { number: string; state: string }
> {
  execute(command: CommandConfirmInvoice) {
    return this.transport.send<{ number: string; state: string }>(
      "POST",
      `/facturas/${command.number}/confirm`,
      {},
    );
  }
}

/**
 * One server, two doors to it: the screens read through theirs, behind a cache; the use case
 * writes through its own — never the screens' —, as an application's generated client does.
 */
function application() {
  const servidor = servidorVentas();
  const screens = cachedTransport(
    memoryTransport(servidor.tables, { handle: servidor.handle, latency: 60 }),
    { entities: [facturas] },
  );
  const ventasBoundedContext = new BoundedContext<VentasDependencies>("ventas");
  ventasBoundedContext.addDependency(
    "transport",
    memoryTransport(servidor.tables, { handle: servidor.handle, latency: 60 }),
  );
  ventasBoundedContext.feature(CommandConfirmInvoice)(ConfirmInvoice);
  const confirm = (number: string) =>
    ventasBoundedContext.execute(new CommandConfirmInvoice(number));
  return { screens, confirm };
}

/** A draft (i = 0). */
const BORRADOR = "F-2026-0001";

function Invoices() {
  const listing = useListing(facturas, {
    pageSize: 6,
    criteria: { order: [{ field: "number" }] },
  });
  return (
    <section aria-label="Lista de facturas">
      <EntityList listing={listing} columns={["number", "state"]} search={false} />
    </section>
  );
}

function Invoice({ confirm }: { confirm: (number: string) => Promise<unknown> }) {
  const invoice = useRecord(facturas, BORRADOR);
  const state =
    invoice.status === "ready"
      ? (textOf(invoice.meta, "state", invoice.record.state) ?? invoice.record.state)
      : "…";
  return (
    <div className="flex flex-col gap-2 border-l border-line pl-4">
      <p className="text-meta">
        {BORRADOR}: {state}
      </p>
      <ServiceButton label="Confirmar" role="primary" run={() => confirm(BORRADOR)} />
    </div>
  );
}

function Screen() {
  const app = useMemo(application, []);
  // What <SincproApp> does by itself: its cache forgets what any write touched.
  useEffect(() => processChanges.follow((change) => app.screens.changed(change)), [app]);
  return (
    <FrameworkProvider transport={app.screens} entities={[facturas]}>
      <div className="grid grid-cols-2 gap-4 p-4">
        <Invoices />
        <Invoice confirm={app.confirm} />
      </div>
    </FrameworkProvider>
  );
}

/** What the list says of one invoice: its number and, right after it, its state. */
const listed = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole("region", { name: "Lista de facturas" }).textContent ?? "";

export const UnCasoDeUsoEscribeYLaPantallaLoMuestra: Story = {
  render: () => <Screen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(`${BORRADOR}: Borrador`)).toBeVisible();
    await waitFor(() => expect(listed(canvasElement)).toMatch(/F-2026-0001\s*Borrador/));
    // The use case writes through its own transport; nothing on the screen reads again by hand.
    await userEvent.click(canvas.getByRole("button", { name: "Confirmar" }));
    await expect(await canvas.findByText(`${BORRADOR}: Publicada`)).toBeVisible();
    await waitFor(() => expect(listed(canvasElement)).toMatch(/F-2026-0001\s*Publicada/));
  },
};
