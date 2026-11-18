import { defineMeta, entity, field } from "@sincpro/client-framework";
import type { AnyRecord } from "@sincpro/criteria";
import { presented, RecordField, RecordLines, useRecord } from "@sincpro/web-framework";
import { Skeleton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";

const meta: Meta = {
  title: "Casos de uso/61 · Una parte con su color",
  parameters: {
    docs: {
      description: {
        component:
          "Las **partes** de un registro —las ejecuciones de un issue, los miembros de un tenant— no tienen entidad propia, así que no hay `presented(ejecuciones, …)` donde decir de qué color es cada estado. Lo declara **una vez** el registro que las tiene: `presented(issues, { parts: { runs: { tones: { status: … } } } })`, tipado por la parte. Lo leen todos los lugares que dibujan esas filas: `RecordField` (las líneas enteras y, cuando el registro trajo sólo una página, `RecordLines`) y `RecordLines` suelto, que encuentra la entidad del registro por su agregado. Una pantalla que quiere otro color pasa `tones` y cambia **sólo ese valor**: el resto sigue siendo el declarado.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

type Run = { id: string; summary: string; status: "queued" | "running" | "done" | "failed" };
type Issue = {
  id: string;
  title: string;
  runs: { items: readonly Run[]; count: { value: number; exact: boolean } };
};

const runMeta = defineMeta({
  aggregate: "Run",
  identity: "id",
  fields: {
    id: field.text({ label: "ID", readonly: true }),
    summary: field.text({ label: "Resumen" }),
    status: field.choice(["queued", "running", "done", "failed"], {
      label: "Estado",
      labels: { queued: "En cola", running: "Corriendo", done: "Terminó", failed: "Falló" },
    }),
  },
});

const issueMeta = defineMeta({
  aggregate: "Issue",
  identity: "id",
  display: "title",
  fields: {
    id: field.text({ label: "ID", readonly: true }),
    title: field.text({ label: "Título" }),
    runs: field.embedded(runMeta, { many: true, label: "Ejecuciones" }),
  },
});

/** How an issue's runs look: said once, with the issue. */
const issues = presented(
  entity<Issue>("forge:issue", { list: "/issues", aggregate: "Issue" }),
  {
    parts: { runs: { tones: { status: { running: "info", done: "good", failed: "bad" } } } },
  },
);

const RUNS: Run[] = [
  { id: "r1", summary: "Primer intento", status: "failed" },
  { id: "r2", summary: "Con el parche", status: "done" },
  { id: "r3", summary: "Otra vez", status: "queued" },
];

const ISSUES: Issue[] = [
  // Every run came with it: the lines are the whole list.
  {
    id: "I-1",
    title: "El build falla",
    runs: { items: RUNS, count: { value: 3, exact: true } },
  },
  // A page of forty: read only, with its real total.
  {
    id: "I-2",
    title: "Reintentos",
    runs: { items: RUNS.slice(0, 2), count: { value: 40, exact: true } },
  },
];

function Issues({ children }: { children: React.ReactNode }) {
  return (
    <Escenario
      tables={{ "/issues": { meta: issueMeta, rows: ISSUES as unknown as AnyRecord[] } }}
      latency={40}
      entities={[issues]}
    >
      {children}
    </Escenario>
  );
}

function Ejecuciones({ id }: { id: string }) {
  const issue = useRecord(issues, id);
  if (issue.status !== "ready") return <Skeleton rows={3} label="Cargando el issue" />;
  return (
    <div className="flex max-w-xl flex-col gap-3 p-6">
      <p>{issue.record.title}</p>
      <RecordField record={issue} name="runs" />
    </div>
  );
}

/** The tag a state is drawn in, by its word. */
async function tagOf(canvasElement: HTMLElement, word: string) {
  const found = await within(canvasElement).findByText(word);
  return found.closest('[data-ui="tag"]');
}

export const SeDeclaraUnaVezConElRegistro: Story = {
  render: () => (
    <Issues>
      <Ejecuciones id="I-1" />
    </Issues>
  ),
  play: async ({ canvasElement }) => {
    // Each state is its tag, in the colour the issue declared for its runs.
    await expect(await tagOf(canvasElement, "Falló")).toHaveAttribute("data-tone", "bad");
    await expect(await tagOf(canvasElement, "Terminó")).toHaveAttribute("data-tone", "good");
    // A value nobody coloured is still a tag, neutral.
    await expect(await tagOf(canvasElement, "En cola")).toHaveAttribute(
      "data-tone",
      "neutral",
    );
  },
};

export const UnaPaginaTambien: Story = {
  render: () => (
    <Issues>
      <Ejecuciones id="I-2" />
    </Issues>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Only a page came: read only, said so — and the colours are the same.
    await canvas.findByText(/40/);
    await expect(await tagOf(canvasElement, "Falló")).toHaveAttribute("data-tone", "bad");
    await expect(await tagOf(canvasElement, "Terminó")).toHaveAttribute("data-tone", "good");
  },
};

export const LaPantallaCambiaUnColor: Story = {
  render: () => (
    <Issues>
      <div className="flex max-w-xl flex-col gap-3 p-6">
        {/* A screen of its own: no entity given — found by the model's aggregate. */}
        <RecordLines<Run>
          record={ISSUES[0]!}
          meta={issueMeta}
          name="runs"
          locale="es"
          tones={{ status: { failed: "warn" } }}
        />
      </div>
    </Issues>
  ),
  play: async ({ canvasElement }) => {
    // The screen's colour for one value, the declared one for the rest.
    await waitFor(async () =>
      expect(await tagOf(canvasElement, "Falló")).toHaveAttribute("data-tone", "warn"),
    );
    await expect(await tagOf(canvasElement, "Terminó")).toHaveAttribute("data-tone", "good");
  },
};
