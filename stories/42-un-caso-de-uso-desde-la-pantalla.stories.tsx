import {
  BoundedContext,
  Command,
  configureProcess,
  memoryTransport,
  processContext,
  servicesWith,
  type Transport,
  TransportError,
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
          "La lógica de una aplicación vive en los **casos de uso** de cada bounded context — `Feature` y `ApplicationService` de @sincpro/client-framework, armados como en sincpro_framework: un Command, el servicio registrado para él y las dependencias heredadas (`servicesWith`) — y la pantalla sólo los corre: `useService((closing) => projectBoundedContext.execute(new CommandCloseIssue(closing.issue_id)))` da `run`, `busy`, `answer` y `error`, sin escribir a mano el estado de cada pantalla. La traza y el reporte son del bounded context: cada caso de uso es un span `<bounded context>/<Service>`, las Features que compone son hijas, y sólo se reporta lo que nadie esperaba — un rechazo que el servidor explicó (un 409) se muestra, no se reporta. El contexto (la empresa, el tenant) es del proceso: los servicios lo leen en `this.context` y una pantalla con `useContextValues`.",
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

const { Feature, ApplicationService } = servicesWith<ProjectDependencies, ProjectContext>();

class CommandPreviewClosing extends Command<{ warnings: string[] }> {
  constructor(readonly issue_id: string) {
    super();
  }
}

class CommandClose extends Command<{ state: string; company: number | undefined }> {
  constructor(readonly issue_id: string) {
    super();
  }
}

class CommandCloseIssue extends Command<{
  closed: boolean;
  warnings: string[];
  company?: number | undefined;
}> {
  constructor(readonly issue_id: string) {
    super();
  }
}

class PreviewClosing extends Feature<CommandPreviewClosing, { warnings: string[] }> {
  execute(command: CommandPreviewClosing) {
    return this.transport.send<{ warnings: string[] }>(
      "POST",
      `/issues/${command.issue_id}/close/preview`,
      { issue_id: command.issue_id },
    );
  }
}

class Close extends Feature<CommandClose, { state: string; company: number | undefined }> {
  async execute(command: CommandClose) {
    const done = await this.transport.send<{ state: string }>(
      "POST",
      `/issues/${command.issue_id}/close`,
      { issue_id: command.issue_id },
    );
    return { ...done, company: this.context.company_id };
  }
}

class CloseIssue extends ApplicationService<
  CommandCloseIssue,
  { closed: boolean; warnings: string[]; company?: number | undefined }
> {
  async execute(command: CommandCloseIssue) {
    const preview = await this.featureBus.execute(
      new CommandPreviewClosing(command.issue_id),
    );
    if (preview.warnings.length > 0) return { closed: false, warnings: preview.warnings };
    const done = await this.featureBus.execute(new CommandClose(command.issue_id));
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
  const projectBoundedContext = new BoundedContext<ProjectDependencies, ProjectContext>(
    "project",
  );
  projectBoundedContext.addDependency("transport", transport);
  projectBoundedContext.feature(CommandPreviewClosing)(PreviewClosing);
  projectBoundedContext.feature(CommandClose)(Close);
  projectBoundedContext.appService(CommandCloseIssue)(CloseIssue);
  // The process is the page's: each story starts it with its own tracer and reporter.
  const start = () => configureProcess({ tracer, reporter });
  const closeIssue = (closing: Closing) =>
    projectBoundedContext.execute(new CommandCloseIssue(closing.issue_id));
  return { tracer, reporter, closeIssue, start };
}

type Project = Pick<ReturnType<typeof application>, "closeIssue">;

function Screen({ project }: { project: Project }) {
  const close = useService(project.closeIssue);
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
  render: () => <Screen project={closable} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    closable.start();
    closable.tracer.spans.length = 0;
    await userEvent.click(canvas.getByRole("button", { name: "Cerrar la incidencia" }));
    await expect(await canvas.findByRole("button", { name: "Cerrando…" })).toBeDisabled();
    await expect(await canvas.findByText("Cerrada")).toBeVisible();
    // One trace: the use case, and the two Features it ran under it.
    const [parent, ...children] = closable.tracer.spans;
    await expect(parent?.name).toBe("project/CloseIssue");
    await expect(children.map((one) => one.name)).toEqual([
      "project/PreviewClosing",
      "project/Close",
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
  render: () => <Screen project={refused} />,
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
  render: () => <Screen project={broken} />,
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
    await expect(report?.about.useCase).toBe("project.PreviewClosing");
    await expect(report?.about.traceId).toBe(broken.tracer.spans[0]?.traceId);
    // The screen still answers: it says what failed, it does not break.
    await expect(
      await canvas.findByRole("button", { name: "Cerrar la incidencia" }),
    ).toBeEnabled();
  },
};

function ScreenWithCompany({ project }: { project: Project }) {
  const { company_id } = useContextValues<ProjectContext>(processContext);
  const close = useService(project.closeIssue);
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
  render: () => <ScreenWithCompany project={withCompany} />,
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
