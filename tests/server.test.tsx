import assert from "node:assert/strict";

import { memoryTransport, type Transport } from "@sincpro/client-framework";
import {
  defineList,
  FrameworkProvider,
  installFrameworkCopy,
  type Listing,
  listingAsk,
  readListing,
  SPANISH_FRAMEWORK_COPY,
  useListing,
  useServiceReading,
} from "@sincpro/web-framework";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { test } from "vitest";

import { type Cliente, CLIENTES, clientes, VENTAS } from "../stories/support/ventas";

installFrameworkCopy(SPANISH_FRAMEWORK_COPY);

/**
 * A transport that writes down every page it is asked for, and answers from VENTAS. A plain
 * wrapper, not a Proxy: the memory transport carries a `bind` that reaches its own methods.
 */
function spied(): { transport: Transport; asked: { route: string; criteria: unknown }[] } {
  const base = memoryTransport(VENTAS);
  const asked: { route: string; criteria: unknown }[] = [];
  const transport: Transport = {
    ...base,
    list: (route, criteria, signal, options) => {
      asked.push({ route, criteria });
      return base.list(route, criteria, signal, options);
    },
  };
  return { transport, asked };
}

function onServer(transport: Transport, children: ReactNode): string {
  return renderToString(
    <FrameworkProvider transport={transport} locale="es">
      {children}
    </FrameworkProvider>,
  );
}

const activos = defineList(clientes, {
  id: "activos",
  title: "Activos",
  scope: { selection: { field: "active", operator: "=", value: true } },
});

test("a listing renders on the server the page read there, its rows in the HTML", async () => {
  const { transport, asked } = spied();
  const page = await readListing(transport, clientes, { pageSize: 3 });

  function Clientes() {
    const listing = useListing(clientes, { pageSize: 3, page });
    return (
      <ul>
        {listing.rows.map((one) => (
          <li key={one.id}>{one.name}</li>
        ))}
      </ul>
    );
  }
  const html = onServer(transport, <Clientes />);

  assert.equal(page.rows.length, 3);
  for (const one of page.rows) assert.ok(html.includes(one.name), `${one.name} in the HTML`);
  assert.equal(asked.length, 1, "only the loader's read: rendering asked nothing");
});

test("without a page, a listing renders on the server as not yet read, instead of failing", () => {
  const { transport, asked } = spied();
  function Clientes() {
    const listing = useListing(clientes);
    return <p>{`${listing.status}:${listing.rows.length}`}</p>;
  }

  assert.equal(onServer(transport, <Clientes />), "<p>idle:0</p>");
  assert.equal(asked.length, 0);
});

test("readListing asks the very question useListing asks: scope, criteria and page size", async () => {
  const { transport, asked } = spied();
  const own = {
    pageSize: 5,
    criteria: { selection: { field: "city", operator: "=", value: "La Paz" } },
  } as const;
  let question: Listing<Cliente>["question"] | undefined;
  function Activos() {
    question = useListing(activos, own).question;
    return null;
  }
  onServer(transport, <Activos />);
  await readListing(transport, activos, own);

  const { route, criteria } = listingAsk(activos, own);
  assert.equal(route, "/clientes");
  assert.deepEqual(asked, [{ route, criteria }]);
  assert.deepEqual(question, criteria);
  assert.equal(criteria.pagination?.limit, 5);
});

test("a service reading renders on the server the answer it was given", () => {
  const { transport } = spied();
  let asked = 0;
  const balance = (member: string) => {
    asked += 1;
    return Promise.resolve(`${member}: 120`);
  };
  function Given() {
    const reading = useServiceReading(balance, ["C-001"], { initial: "C-001: 120" });
    return <p>{`${reading.status}:${reading.answer}`}</p>;
  }
  function NotGiven() {
    const reading = useServiceReading(balance, ["C-001"]);
    return <p>{reading.status}</p>;
  }

  assert.equal(onServer(transport, <Given />), "<p>ready:C-001: 120</p>");
  assert.equal(onServer(transport, <NotGiven />), "<p>loading</p>");
  assert.equal(asked, 0);
  assert.ok(CLIENTES.length > 3);
});
