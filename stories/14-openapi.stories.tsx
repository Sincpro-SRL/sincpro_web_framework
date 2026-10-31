import type { Meta as ModelMeta } from "@sincpro/criteria";
import {
  completeMeta,
  factsOf,
  metaFromSchema,
  type SchemaComponents,
} from "@sincpro/web-framework";
import { Record } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import forge from "./support/forge-openapi.json" with { type: "json" };

const meta: Meta = {
  title: "Casos de uso/14 · Lo que trae OpenAPI",
  parameters: {
    docs: {
      description: {
        component:
          "El OpenAPI de un forge corriendo, recortado a los esquemas del proyecto. Lo que sirve y lo que no: las **lecturas** responden con esquema `{}` — la meta de una lista no sale de acá —, pero los **comandos y los value objects** están bien descritos, y mejor que la meta en un lugar: adentro de un value object la meta del servidor manda un `Literal` y una lista de textos como `unknown`. A la izquierda, la especificación de un proyecto leída con la meta del servidor; a la derecha, la misma meta completada con el esquema (`completeMeta`): los chequeos se leen como lista y los campos tienen nombre.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const SPEC = {
  host: "local",
  review_host: "github",
  review_cli: "gh",
  agent_binary: "claude",
  agent_model: "",
  language: "es",
  verification_checks: ["make test", "make lint"],
  engineer_review: true,
};

const servidor = forge.specificationMeta as unknown as ModelMeta;
const completada = completeMeta(
  servidor,
  metaFromSchema("ProjectSpecification", forge.components as unknown as SchemaComponents),
);
const CAMPOS = ["language", "verification_checks", "review_host", "engineer_review"];

export const LaMetaDelServidorYLaCompletada: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-6 bg-ground p-6">
      <section aria-label="Con la meta del servidor">
        <Record identity={{ title: "Meta del servidor", subtitle: "entity_meta_data" }}>
          <Record.Paper layout="horizontal">
            <Record.Facts fields={factsOf(SPEC, servidor, CAMPOS)} />
          </Record.Paper>
        </Record>
      </section>
      <section aria-label="Completada con OpenAPI">
        <Record identity={{ title: "Completada con OpenAPI", subtitle: "completeMeta" }}>
          <Record.Paper layout="horizontal">
            <Record.Facts fields={factsOf(SPEC, completada, CAMPOS)} />
          </Record.Paper>
        </Record>
      </section>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const raw = within(canvas.getByRole("region", { name: "Con la meta del servidor" }));
    const done = within(canvas.getByRole("region", { name: "Completada con OpenAPI" }));
    // What the server's meta says of a list of texts it typed as `unknown`: raw JSON.
    await expect(raw.getByText('["make test","make lint"]')).toBeInTheDocument();
    await expect(raw.getByText("verification_checks")).toBeInTheDocument();
    // Completed with the schema: a list, and a name for the field.
    await expect(done.getByText("make test, make lint")).toBeInTheDocument();
    await expect(done.getByText("Verification Checks")).toBeInTheDocument();
  },
};
