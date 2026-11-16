import {
  BoundedContext,
  Command,
  entity,
  memoryTransport,
  readRoute,
  servicesWith,
  type Transport,
} from "@sincpro/client-framework";
import { FrameworkProvider, useService, useServiceReading } from "@sincpro/web-framework";
import { Button } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

const meta: Meta = {
  title: "Casos de uso/51 · Leer por un caso de uso",
  parameters: {
    docs: {
      description: {
        component:
          "Lo que una pantalla **lee** por un caso de uso —el saldo de un socio, que no es una lista ni un registro— se lee con `useServiceReading(caso, argumentos, { follows })`: corre al montar, **otra vez cuando cambian los argumentos** (otra pestaña, otro socio), cuando cambia el contexto del proceso (otra empresa) y cuando alguien escribe en una entidad que sigue. Nunca muestra la respuesta de otros argumentos: otro socio empieza «leyendo», y una respuesta lenta del socio que se dejó se descarta. `useService` sigue siendo el de las **acciones**: corre cuando la persona aprieta.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

type Saldo = { member: string; balance: string };
type Dependencies = { transport: Transport };
const { Feature } = servicesWith<Dependencies>();

class QuerySaldo extends Command<Saldo> {
  constructor(readonly member_id: string) {
    super();
  }
}

class CommandPagar extends Command<{ ok: boolean }> {
  constructor(
    readonly member_id: string,
    readonly amount: string,
  ) {
    super();
  }
}

class LeerSaldo extends Feature<QuerySaldo, Saldo> {
  execute(query: QuerySaldo) {
    return readRoute<Saldo>(this.transport, `/socios/${query.member_id}/saldo`);
  }
}

class Pagar extends Feature<CommandPagar, { ok: boolean }> {
  execute(command: CommandPagar) {
    return this.transport.send<{ ok: boolean }>("POST", "/pagos", {
      member_id: command.member_id,
      amount: command.amount,
    });
  }
}

/** The payments: what a payment writes, and what the balance follows. */
const pagos = entity("socios:pago", { list: "/pagos" });

/** The association's bounded context over its own in-memory server. Ana's balance is slow to
 *  answer — the tab a person leaves before it arrives. */
function asociacion() {
  const saldos: Record<string, number> = { ana: 120, beto: 45 };
  const transport = memoryTransport(
    {},
    {
      latency: 60,
      read: async (route) => {
        const id = route.split("/")[2] ?? "";
        if (id === "ana") await new Promise((done) => setTimeout(done, 900));
        return { member: id, balance: (saldos[id] ?? 0).toFixed(2) };
      },
      handle: (_method, _route, body) => {
        const pago = body as { member_id: string; amount: string };
        saldos[pago.member_id] = (saldos[pago.member_id] ?? 0) - Number(pago.amount);
        return { ok: true };
      },
    },
  );
  const socios = new BoundedContext<Dependencies>("socios");
  socios.addDependency("transport", transport);
  socios.feature(QuerySaldo)(LeerSaldo);
  socios.feature(CommandPagar)(Pagar);
  return {
    transport,
    saldo: (member: string) => socios.execute(new QuerySaldo(member)),
    pagar: (member: string, amount: string) =>
      socios.execute(new CommandPagar(member, amount)),
  };
}

function Cuenta({ app }: { app: ReturnType<typeof asociacion> }) {
  const [quien, setQuien] = useState("beto");
  const saldo = useServiceReading(app.saldo, [quien], { follows: [pagos] });
  const pagar = useService(app.pagar);
  return (
    <div className="flex max-w-md flex-col gap-3 p-6">
      <div className="flex gap-2">
        {["ana", "beto"].map((one) => (
          <Button
            key={one}
            size="sm"
            role={one === quien ? "primary" : "ghost"}
            onClick={() => setQuien(one)}
          >
            {one === "ana" ? "Ana" : "Beto"}
          </Button>
        ))}
      </div>
      <p aria-label="Saldo" className="text-meta">
        {saldo.status === "ready" && saldo.answer !== undefined
          ? `${saldo.answer.member}: ${saldo.answer.balance}`
          : "Leyendo…"}
      </p>
      <Button size="sm" onClick={() => void pagar.run(quien, "20")}>
        Pagar 20
      </Button>
    </div>
  );
}

function Escena() {
  const app = useMemo(asociacion, []);
  return (
    <FrameworkProvider transport={app.transport} locale="es">
      <Cuenta app={app} />
    </FrameworkProvider>
  );
}

export const OtroSocioNuncaMuestraElSaldoDelQueSeDejo: Story = {
  render: () => <Escena />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const saldo = canvas.getByLabelText("Saldo");
    await waitFor(() => expect(saldo).toHaveTextContent("beto: 45.00"));
    // Another member: reading — never Beto's balance under Ana's name.
    await userEvent.click(canvas.getByRole("button", { name: "Ana" }));
    await expect(saldo).toHaveTextContent("Leyendo…");
    // Back before Ana's slow answer arrives: Beto's, and Ana's late answer never lands.
    await userEvent.click(canvas.getByRole("button", { name: "Beto" }));
    await waitFor(() => expect(saldo).toHaveTextContent("beto: 45.00"));
    await new Promise((done) => setTimeout(done, 1200));
    await expect(saldo).toHaveTextContent("beto: 45.00");
  },
};

export const UnPagoLoLeeDeNuevo: Story = {
  render: () => <Escena />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const saldo = canvas.getByLabelText("Saldo");
    await waitFor(() => expect(saldo).toHaveTextContent("beto: 45.00"));
    // A write to what the reading follows — sent by another use case — reads it again.
    await userEvent.click(canvas.getByRole("button", { name: "Pagar 20" }));
    await waitFor(() => expect(saldo).toHaveTextContent("beto: 25.00"));
  },
};
