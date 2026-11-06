import {
  ApplicationService,
  configureProcess,
  Feature,
  memoryTransport,
  processContext,
  type Transport,
  TransportError,
  UseBoundedContext,
} from "@sincpro/client-framework";
import { memoryReporter, memoryTracer } from "@sincpro/client-framework/testing";
import { Refused, useContextValues, useService } from "@sincpro/web-framework";
import { Button } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

const meta: Meta = {
  title: "Casos de uso/42 · Un caso de uso desde la pantalla",
  parameters: {
    docs: {
      description: {
        component:
          "La lógica de una aplicación vive en los **servicios** de cada bounded context — `Feature` y `ApplicationService` de @sincpro/client-framework, armados como en sincpro_framework — y la pantalla sólo los corre: `useService(project.CloseIssue.execute)` da `run`, `busy`, `answer` y `error`, sin escribir a mano el estado de cada pantalla. La traza y el reporte son del bounded context: cada caso de uso es un span `<bounded context>/<Service>.<method>`, las Features que compone son hijas, y sólo se reporta lo que nadie esperaba — un rechazo que el servidor explicó (un 409) se muestra, no se reporta. El contexto (la empresa, el tenant) es del proceso: los servicios lo leen en `this.context` y una pantalla con `useContextValues`.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

type Closing = { issue_id: string };

/** What the services of «project» can count on: `this.transport`. */
type ProjectDependencies = { transport: Transport };

/** What «project» runs with besides: `this.context.company_id`. */
type ProjectContext = { company_id: number };

class Issues extends Feature<ProjectDependencies, ProjectContext> {
  preview(closing: Closing) {
    return this.transport.send<{ warnings: string[] }>(
      "POST",
      `/issues/${closing.issue_id}/close/preview`,
      closing,
    );
  }

  async close(closing: Closing) {
    const done = await this.transport.send<{ state: string }>(
      "POST",
      `/issues/${closing.issue_id}/close`,
      closing,
    );
    return { ...done, company: this.context.company_id };
  }
}

class CloseIssue extends ApplicationService<
  ProjectDependencies,
  { Issues: typeof Issues },
  ProjectContext
> {
  async execute(closing: Closing) {
    const preview = await this.feature.Issues.preview(closing);
    if (preview.warnings.length > 0) return { closed: false, warnings: preview.warnings };
    const done = await this.feature.Issues.close(closing);
    return { closed: done.state === "closed", warnings: [], company: done.company };
  }
}

/**
 * The application's part: its bounded context over a transport, and what its `main` gives the
 * process — a tracer and a reporter that keep what they are told.
 */
function application(answer: (route: string) => unknown) {
  const tracer = memoryTracer();
  const reporter = memoryReporter();
  const transport = memoryTransport(
    {},
    { latency: 150, handle: (_method, route) => answer(route) },
  );
  const project = new UseBoundedContext<ProjectDependencies, ProjectContext>("project")
    .addDependency("transport", transport)
    .register({ features: { Issues }, applicationServices: { CloseIssue } });
  // The process is the page's: each story starts it with its own tracer and reporter.
  const start = () => configureProcess({ tracer, reporter });
  return { tracer, reporter, project, start };
}

type Project = ReturnType<typeof application>["project"];

function Screen({ project }: { project: Project }) {
  const close = useService(project.CloseIssue.execute);
  return (
    <div className="flex max-w-md flex-col gap-3 p-6">
      <Button disabled={close.busy} onClick={() => void close.run({ issue_id: "acme-3" })}>
        {close.busy ? "Cerrando…" : "Cerrar la incidencia"}
      </Button>
      {close.answer?.closed ? <p className="text-meta">Cerrada</p> : null}
      {close.error ? <Refused error={close.error} /> : null}
    </div>
  );
}

const closable = application((route) =>
  route.endsWith("/preview") ? { warnings: [] } : { state: "closed" },
);

export const LaPantallaCorreElServicioYQuedaTrazado: Story = {
  render: () => <Screen project={closable.project} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    closable.start();
    closable.tracer.spans.length = 0;
    await userEvent.click(canvas.getByRole("button", { name: "Cerrar la incidencia" }));
    await expect(await canvas.findByRole("button", { name: "Cerrando…" })).toBeDisabled();
    await expect(await canvas.findByText("Cerrada")).toBeVisible();
    // One trace: the use case, and the two Feature methods it ran under it.
    const [parent, ...children] = closable.tracer.spans;
    await expect(parent?.name).toBe("project/CloseIssue");
    await expect(children.map((one) => one.name)).toEqual([
      "project/Issues.preview",
      "project/Issues.close",
    ]);
    for (const child of children) await expect(child.parentSpanId).toBe(parent?.spanId);
    await expect(closable.reporter.reports).toHaveLength(0);
  },
};

const refused = application((route) => {
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
  render: () => <Screen project={refused.project} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    refused.start();
    refused.reporter.reports.length = 0;
    await userEvent.click(canvas.getByRole("button", { name: "Cerrar la incidencia" }));
    await expect(
      await canvas.findByText("La incidencia tiene una corrida en curso"),
    ).toBeVisible();
    await expect(canvas.getByText("Detenela antes de cerrarla.")).toBeVisible();
    // The business answered: shown to the person, never reported as a fault.
    await waitFor(() => expect(refused.tracer.spans[0]?.outcome).toBe("refused"));
    await expect(refused.reporter.reports).toHaveLength(0);
  },
};

const broken = application(() => {
  throw new TypeError("Cannot read properties of undefined (reading 'warnings')");
});

export const LoQueNadieEsperabaSeReportaConSuTraza: Story = {
  render: () => <Screen project={broken.project} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    broken.start();
    broken.reporter.reports.length = 0;
    await userEvent.click(canvas.getByRole("button", { name: "Cerrar la incidencia" }));
    // Once, where it happened: the Feature that broke, not again by the ApplicationService it
    // threw through.
    await waitFor(() => expect(broken.tracer.spans[0]?.outcome).toBe("failed"));
    await expect(broken.reporter.reports).toHaveLength(1);
    const [report] = broken.reporter.reports;
    await expect(report?.about.useCase).toBe("project.Issues.preview");
    await expect(report?.about.traceId).toBe(broken.tracer.spans[0]?.traceId);
    // The screen still answers: it says what failed, it does not break.
    await expect(
      await canvas.findByRole("button", { name: "Cerrar la incidencia" }),
    ).toBeEnabled();
  },
};

function ScreenWithCompany({ project }: { project: Project }) {
  const { company_id } = useContextValues<ProjectContext>(processContext);
  const close = useService(project.CloseIssue.execute);
  return (
    <div className="flex max-w-md flex-col gap-3 p-6">
      <p className="text-meta">{`Empresa ${company_id ?? "—"}`}</p>
      <Button onClick={() => processContext.set({ company_id: 2 })}>
        Cambiar a la empresa 2
      </Button>
      <Button disabled={close.busy} onClick={() => void close.run({ issue_id: "acme-3" })}>
        Cerrar la incidencia
      </Button>
      {close.answer?.closed ? (
        <p className="text-meta">{`Cerrada en la empresa ${close.answer.company}`}</p>
      ) : null}
    </div>
  );
}

const withCompany = application((route) =>
  route.endsWith("/preview") ? { warnings: [] } : { state: "closed" },
);

export const ElContextoLoVeLaPantallaYLoUsaElServicio: Story = {
  render: () => <ScreenWithCompany project={withCompany.project} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    withCompany.start();
    processContext.set({ company_id: 1 });
    await expect(await canvas.findByText("Empresa 1")).toBeVisible();
    // Another company: the screen that shows it draws again, with nothing passed down to it.
    await userEvent.click(canvas.getByRole("button", { name: "Cambiar a la empresa 2" }));
    await expect(await canvas.findByText("Empresa 2")).toBeVisible();
    // And the use case runs with it — its Feature reads it in `this.context`.
    await userEvent.click(canvas.getByRole("button", { name: "Cerrar la incidencia" }));
    await expect(await canvas.findByText("Cerrada en la empresa 2")).toBeVisible();
  },
};
