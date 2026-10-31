import type { Criteria } from "@sincpro/criteria";
import type { ViewProps } from "@sincpro/web-composer";
import { useCrumbs } from "@sincpro/web-composer";
import {
  defineList,
  EntityList,
  EntitySearchBar,
  entityView,
  factsOf,
  listView,
  memoryTransport,
  SincproApp,
  textOf,
  useListing,
  useRecord,
  useRecordInWorkspace,
} from "@sincpro/web-framework";
import { List, Record, Skeleton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Escenario } from "./support/escenario";
import { servidorVentas } from "./support/servidor";
import { type Factura, facturaMeta, facturas, VENTAS } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/21 · Listas con dominio",
  parameters: {
    docs: {
      description: {
        component:
          "Una entidad se mira de varias maneras: las facturas **por cobrar**, los **borradores**, **por cliente**. `defineList(entidad, { id, title, scope, columns, filters, groupBy })` lo declara una vez, como dato: el `scope` es un corte fijo que se suma (AND) debajo de todo lo que se busca, filtra o agrupa, y la barra no lo puede quitar. `useListing(lista)` lo lee, `EntityList` dibuja lo que declara y `listView(lista)` la abre en el workspace con su propio «Ir a» en ⌘K — sus filas abren el registro que registró `entityView`.\n\nY una pantalla que necesita su propia forma — tarjetas, otra tabla — usa la misma `Listing` con `EntitySearchBar`: el scope, la búsqueda y el servidor son los mismos (nivel 2).",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const porCobrar = defineList(facturas, {
  id: "por-cobrar",
  title: "Por cobrar",
  description: "publicadas, todavía sin pagar",
  scope: { where: { field: "state", operator: "=", value: "posted" } },
  columns: ["number", "customer", "due_date", "amount_total"],
  filters: [
    {
      id: "urgentes",
      label: "Urgentes",
      where: { field: "urgent", operator: "=", value: true },
    },
  ],
});

const porCliente = defineList(facturas, {
  id: "por-cliente",
  title: "Por cliente",
  columns: ["number", "state", "amount_total"],
  groupBy: [{ field: "customer_name" }],
});

/** Each story keeps its OWN log of what reached the server: a shared one lets a story's wait be
 *  satisfied by another story's request. */
function escenarioCon(pedidos: Criteria[]) {
  const observar = (_route: string, criteria: Criteria) => pedidos.push(criteria);
  return [
    (Story: () => React.JSX.Element) => (
      <Escenario tables={VENTAS} observe={observar}>
        <Story />
      </Escenario>
    ),
  ];
}
const pedidosCorte: Criteria[] = [];
const pedidosPropia: Criteria[] = [];

/** Types in the search bar and puts it on the customer's name — the bar offers each field of the
 *  entity's search template; Enter alone would take the first (the number). */
async function buscarCliente(canvasElement: HTMLElement, text: string) {
  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);
  await userEvent.type(await canvas.findByPlaceholderText(/Buscar/), text);
  // web-ui draws its suggestions without a role (ROADMAP): found by their words.
  await userEvent.click(await page.findByText("Nombre del cliente"));
}

/** The state column says «Publicada» on every row a scope of `posted` lets through. */
const estados = (root: HTMLElement) =>
  [...root.querySelectorAll("tbody tr")].map((tr) => tr.textContent ?? "");

export const UnCorteQueNoSeQuita: Story = {
  render: () => <EntityList listing={useListing(porCobrar, { pageSize: 50 })} />,
  decorators: escenarioCon(pedidosCorte),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Its own words and columns, from the definition.
    await canvas.findByRole("heading", { name: "Por cobrar" });
    await expect(await canvas.findByRole("columnheader", { name: /Vence/ })).toBeVisible();
    // Only what the scope lets through: the 21 posted invoices of 64.
    await expect(await canvas.findByText("1–21")).toBeVisible();
    await waitFor(() => expect(pedidosCorte.at(-1)?.where).toEqual(porCobrar.scope?.where));
    // A search ANDs UNDER the scope — it never widens it.
    await buscarCliente(canvasElement, "Globex");
    await waitFor(() =>
      expect(JSON.stringify(pedidosCorte.at(-1)?.where)).toContain("Globex"),
    );
    await expect(JSON.stringify(pedidosCorte.at(-1)?.where)).toContain('"posted"');
    // Only Globex's posted invoices: some, and every one of them Globex's.
    await waitFor(() => {
      const rows = estados(canvasElement);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.includes("Globex"))).toBe(true);
    });
  },
};

export const AgrupadaDesdeElPrincipio: Story = {
  render: () => <EntityList listing={useListing(porCliente)} />,
  decorators: escenarioCon([]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Por cliente" });
    // Opens grouped by customer, counted by the server: 8 customers, 64 invoices.
    await expect(await canvas.findByText(/8 grupos · 64 registros/)).toBeVisible();
    await expect(canvas.getByRole("button", { name: /Globex Bolivia.*8/ })).toBeVisible();
  },
};

/** A screen of its own over the same listing: cards, not a table — and the same search bar. */
function Tarjetas() {
  const listing = useListing(porCobrar, { pageSize: 50 });
  return (
    <List<Factura>
      items={listing.rows}
      keyOf={(f) => f.number}
      present="rows"
      state={{ loading: listing.status === "loading" }}
    >
      <List.Bar>
        <List.Identity title="Mis cobros" description="la vista de un cobrador" />
        <List.Search>
          <EntitySearchBar listing={listing} filters={porCobrar.filters ?? []} />
        </List.Search>
      </List.Bar>
      <List.Rows<Factura>
        row={(f) => ({
          name: f.customer.name,
          meta: `${f.number} · ${textOf(listing.meta, "amount_total", f.amount_total, listing.locale)}`,
        })}
      />
    </List>
  );
}

export const UnaVistaPropia: Story = {
  render: () => <Tarjetas />,
  decorators: escenarioCon(pedidosPropia),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Mis cobros" });
    await waitFor(() => expect(pedidosPropia.at(-1)?.where).toEqual(porCobrar.scope?.where));
    await buscarCliente(canvasElement, "Globex");
    // The same question reaches the server: the scope, and under it what was typed.
    await waitFor(() =>
      expect(JSON.stringify(pedidosPropia.at(-1)?.where)).toContain("Globex"),
    );
    await expect(JSON.stringify(pedidosPropia.at(-1)?.where)).toContain('"posted"');
    await waitFor(() =>
      expect(canvas.getAllByText(/^F-2026-\d{4} · /).length).toBeGreaterThan(0),
    );
    await expect(canvas.queryByText(/Importadora del Oriente/)).toBeNull();
  },
};

function Factura({ api, resource }: ViewProps) {
  const factura = useRecord(facturas, resource.id ?? "");
  useRecordInWorkspace(api, factura);
  const crumbs = useCrumbs(api);
  if (factura.status !== "ready") return <Skeleton rows={3} label="Cargando" />;
  return (
    <Record identity={{ title: factura.record.number }}>
      <Record.Rail>
        {crumbs.length === 0 ? null : <Record.Crumbs crumbs={crumbs} />}
      </Record.Rail>
      <Record.Paper layout="horizontal">
        <Record.Facts
          fields={factsOf(factura.record, factura.meta, ["state", "amount_total"], {
            locale: "es",
          })}
        />
      </Record.Paper>
    </Record>
  );
}

function App() {
  const transport = useMemo(() => {
    const servidor = servidorVentas();
    return memoryTransport(servidor.tables, { latency: 40, handle: servidor.handle });
  }, []);
  const views = useMemo(
    () => [
      entityView(facturas, {
        transport,
        name: "Facturas",
        meta: facturaMeta,
        list: ({ api }) => <EntityList listing={useListing(facturas)} api={api} />,
        record: Factura,
      }),
      listView(porCobrar),
      listView(porCliente),
    ],
    [transport],
  );
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-ground">
      <SincproApp
        transport={transport}
        views={views}
        start={facturas.ref()}
        metas={{ [facturas.key]: facturaMeta }}
      />
    </div>
  );
}

export const EnElWorkspace: Story = {
  render: () => <App />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await canvas.findByText("1–50");
    // ⌘K offers the named list by its name, like any other place to go.
    await userEvent.keyboard("{Meta>}k{/Meta}");
    const palette = await page.findByRole("dialog");
    await userEvent.type(within(palette).getByRole("combobox"), "Por cobrar");
    await userEvent.click(await within(palette).findByRole("option", { name: /Por cobrar/ }));
    await canvas.findByRole("heading", { name: "Por cobrar" });
    await expect(await canvas.findByText("1–21")).toBeVisible();
    // Its rows open the ENTITY's record: the list view needs no record screen of its own.
    const [first] = await canvas.findAllByText(/^F-2026-\d{4}$/);
    const number = first!.textContent ?? "";
    await userEvent.click(first!);
    await expect(await canvas.findByRole("heading", { name: number })).toBeVisible();
  },
};
