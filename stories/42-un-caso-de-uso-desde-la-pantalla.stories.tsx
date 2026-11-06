import {
  ApplicationService,
  bindServices,
  createRuntime,
  Feature,
  memoryTransport,
  type Transport,
  TransportError,
} from "@sincpro/client-framework";
import { memoryReporter, memoryTracer } from "@sincpro/client-framework/testing";
import { Refused, useService } from "@sincpro/web-framework";
import { Button } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

const meta: Meta = {
  title: "Casos de uso/42 · Un caso de uso desde la pantalla",
  parameters: {
    docs: {
      description: {
        component:
          "La lógica de una aplicación vive en sus **servicios** — `Feature` y `ApplicationService` de @sincpro/client-framework — y la pantalla sólo los corre: `useService(proyecto.cerrar)` da `run`, `busy`, `answer` y `error`, sin escribir a mano el contexto de cada pantalla. La traza y el reporte son del servicio: cada caso de uso es un span `<dominio>/<clave>`, sus Features son hijos, y sólo se reporta lo que nadie esperaba — un rechazo que el servidor explicó (un 409) se muestra, no se reporta.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

type Cierre = { issue_id: string };

class Previsualizar extends Feature<{ transport: Transport }> {
  execute(cierre: Cierre) {
    return this.deps.transport.send<{ warnings: string[] }>(
      "POST",
      `/issues/${cierre.issue_id}/close/preview`,
      cierre,
    );
  }
}

class Enviar extends Feature<{ transport: Transport }> {
  execute(cierre: Cierre) {
    return this.deps.transport.send<{ state: string }>(
      "POST",
      `/issues/${cierre.issue_id}/close`,
      cierre,
    );
  }
}

class Cerrar extends ApplicationService<{ previsualizar: Previsualizar; enviar: Enviar }> {
  async execute(cierre: Cierre) {
    const preview = await this.features.previsualizar.execute(cierre);
    if (preview.warnings.length > 0) return { cerrada: false, avisos: preview.warnings };
    const hecho = await this.features.enviar.execute(cierre);
    return { cerrada: hecho.state === "closed", avisos: [] };
  }
}

/** The application's part: its transport, its runtime, its services — bound once. */
function aplicacion(responder: (route: string) => unknown) {
  const tracer = memoryTracer();
  const reporter = memoryReporter();
  const transport = memoryTransport(
    {},
    { latency: 150, handle: (_method, route) => responder(route) },
  );
  const proyecto = bindServices(createRuntime({ tracer, reporter }), "proyecto", {
    cerrar: new Cerrar({
      previsualizar: new Previsualizar({ transport }),
      enviar: new Enviar({ transport }),
    }),
  });
  return { tracer, reporter, proyecto };
}

function Pantalla({ proyecto }: { proyecto: ReturnType<typeof aplicacion>["proyecto"] }) {
  const cerrar = useService(proyecto.cerrar);
  return (
    <div className="flex max-w-md flex-col gap-3 p-6">
      <Button disabled={cerrar.busy} onClick={() => void cerrar.run({ issue_id: "acme-3" })}>
        {cerrar.busy ? "Cerrando…" : "Cerrar la incidencia"}
      </Button>
      {cerrar.answer?.cerrada ? <p className="text-meta">Cerrada</p> : null}
      {cerrar.error ? <Refused error={cerrar.error} /> : null}
    </div>
  );
}

const cerrable = aplicacion((route) =>
  route.endsWith("/preview") ? { warnings: [] } : { state: "closed" },
);

export const LaPantallaCorreElServicioYQuedaTrazado: Story = {
  render: () => <Pantalla proyecto={cerrable.proyecto} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    cerrable.tracer.spans.length = 0;
    await userEvent.click(canvas.getByRole("button", { name: "Cerrar la incidencia" }));
    await expect(await canvas.findByRole("button", { name: "Cerrando…" })).toBeDisabled();
    await expect(await canvas.findByText("Cerrada")).toBeVisible();
    // One trace: the use case, and its two Features under it.
    const [padre, ...hijos] = cerrable.tracer.spans;
    await expect(padre?.name).toBe("proyecto/cerrar");
    await expect(hijos.map((one) => one.name)).toEqual([
      "proyecto/previsualizar",
      "proyecto/enviar",
    ]);
    for (const hijo of hijos) await expect(hijo.parentSpanId).toBe(padre?.spanId);
    await expect(cerrable.reporter.reports).toHaveLength(0);
  },
};

const rechazada = aplicacion((route) => {
  if (route.endsWith("/preview")) return { warnings: [] };
  throw new TransportError(route, 409, {
    kind: "conflict",
    reason: "ISSUE_RUNNING",
    next_step: "fix_request",
    retryable: false,
    errors: [],
    extensions: {},
    title: "La incidencia tiene una corrida en curso",
    guidance: "Detenela antes de cerrarla.",
  });
});

export const UnRechazoSeMuestraYNoSeReporta: Story = {
  render: () => <Pantalla proyecto={rechazada.proyecto} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    rechazada.reporter.reports.length = 0;
    await userEvent.click(canvas.getByRole("button", { name: "Cerrar la incidencia" }));
    await expect(
      await canvas.findByText("La incidencia tiene una corrida en curso"),
    ).toBeVisible();
    await expect(canvas.getByText("Detenela antes de cerrarla.")).toBeVisible();
    // The business answered: shown to the person, never reported as a fault.
    await waitFor(() => expect(rechazada.tracer.spans[0]?.outcome).toBe("refused"));
    await expect(rechazada.reporter.reports).toHaveLength(0);
  },
};

const rota = aplicacion(() => {
  throw new TypeError("Cannot read properties of undefined (reading 'warnings')");
});

export const LoQueNadieEsperabaSeReportaConSuTraza: Story = {
  render: () => <Pantalla proyecto={rota.proyecto} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    rota.reporter.reports.length = 0;
    await userEvent.click(canvas.getByRole("button", { name: "Cerrar la incidencia" }));
    // Once, where it happened: the Feature that broke, not again by the ApplicationService it
    // threw through.
    await waitFor(() => expect(rota.tracer.spans[0]?.outcome).toBe("failed"));
    await expect(rota.reporter.reports).toHaveLength(1);
    const [reporte] = rota.reporter.reports;
    await expect(reporte?.about.useCase).toBe("proyecto/previsualizar");
    await expect(reporte?.about.traceId).toBe(rota.tracer.spans[0]?.traceId);
    // The screen still answers: it says what failed, it does not break.
    await expect(
      await canvas.findByRole("button", { name: "Cerrar la incidencia" }),
    ).toBeEnabled();
  },
};
