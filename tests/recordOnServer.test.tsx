import assert from "node:assert/strict";

import {
  type CallOptions,
  configureProcess,
  entity,
  installTimeZone,
  memoryTransport,
  type One,
  type ResourceRef,
  type Transport,
} from "@sincpro/client-framework";
import { memoryLogger, memoryTracer } from "@sincpro/client-framework/testing";
import type { AnyRecord } from "@sincpro/criteria";
import { createTestApi } from "@sincpro/web-composer";
import {
  EntityRecord,
  FrameworkProvider,
  installFrameworkCopy,
  RecordField,
  SPANISH_FRAMEWORK_COPY,
  useFramework,
  useRecord,
} from "@sincpro/web-framework";
import { readRecordOnServer, type RecordRead } from "@sincpro/web-framework/core";
import { Record, Skeleton } from "@sincpro/web-ui";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, test } from "vitest";

import { type Factura, facturas, VENTAS } from "../stories/support/ventas";

installFrameworkCopy(SPANISH_FRAMEWORK_COPY);

afterEach(() => {
  configureProcess();
  installTimeZone(undefined);
});

/** F-2026-0005: posted, paid by card, created 2026-01-05 14:14 UTC — 10:14 in La Paz. */
const NUMERO = "F-2026-0005";

/**
 * A transport that writes down every record and page it is asked for, and answers from VENTAS.
 * A plain wrapper, not a Proxy: the memory transport carries a `bind` that reaches its own
 * methods.
 */
function spied(base: Transport = memoryTransport(VENTAS)) {
  const asked: { one: string[]; list: { route: string; criteria: unknown }[] } = {
    one: [],
    list: [],
  };
  const transport: Transport = {
    ...base,
    one: (route, signal, options) => {
      asked.one.push(route);
      return base.one(route, signal, options);
    },
    list: (route, criteria, signal, options) => {
      asked.list.push({ route, criteria });
      return base.list(route, criteria, signal, options);
    },
  };
  return { transport, asked };
}

/** The lines the read left on the process's log — beside the screens' use case's own (its
 *  execution started and finished). */
const notRead = (logs: ReturnType<typeof memoryLogger>) =>
  logs.records.filter((line) => /read on the server failed/.test(line.message));

/** What a page renders on the server: the provider an application mounts, its language and
 *  the business's zone. */
function onServer(transport: Transport, children: ReactNode): string {
  return renderToString(
    <FrameworkProvider transport={transport} locale="es" timeZone="America/La_Paz">
      {children}
    </FrameworkProvider>,
  );
}

/** A record screen of an application's own: its skeleton until the record is ready. */
function FacturaPage({
  opened,
  initial,
}: {
  opened: string | ResourceRef;
  initial?: RecordRead<Factura> | undefined;
}) {
  const factura = useRecord(facturas, opened, { initial });
  if (factura.status !== "ready") return <Skeleton rows={4} label="Cargando la factura" />;
  return (
    <Record identity={{ title: factura.record.number || "Nueva factura" }}>
      <Record.Paper>
        {["state", "invoice_date", "payment", "card_reference", "notes", "created_at"].map(
          (name) => (
            <RecordField key={name} record={factura} name={name} />
          ),
        )}
      </Record.Paper>
    </Record>
  );
}

test("a record read on the server crosses as plain JSON: the record, its model, its draft, and what it was read for", async () => {
  const draft = { version: 3, origin_version: 1 };
  const base = memoryTransport(VENTAS, { draft: () => draft });
  // A transport that answers a value as an instance — a date —, as a decoder may.
  const transport: Transport = {
    ...base,
    one: async <T,>(route: string, signal?: AbortSignal, options?: CallOptions) => {
      const answer = await base.one<AnyRecord>(route, signal, options);
      const seen_at = new Date(Date.UTC(2026, 10, 19));
      return { ...answer, record: { ...answer.record, seen_at } } as One<T>;
    },
  };

  const read = await readRecordOnServer(transport, facturas, NUMERO);

  assert.ok(read !== undefined);
  assert.equal(read.entity, "ventas:factura");
  assert.equal(read.id, NUMERO);
  assert.equal(read.record?.number, NUMERO);
  assert.equal(read.record?.customer.name, "Agroindustrial Chiquitano");
  assert.equal(read.meta?.aggregate, "Factura");
  assert.deepEqual(read.draft, draft);
  // Data, never instances: what a Client Component is handed as a prop — a date as its text.
  assert.equal(
    (read.record as Factura & { seen_at: unknown }).seen_at,
    "2026-11-19T00:00:00.000Z",
  );
  assert.deepEqual(JSON.parse(JSON.stringify(read)), read);
  assert.equal(Object.getPrototypeOf(read.record), Object.prototype);
  assert.equal(Object.getPrototypeOf(read.meta), Object.prototype);
});

test("a record opened by its reference is read by the reference's id", async () => {
  const { transport, asked } = spied();

  const read = await readRecordOnServer(transport, facturas, facturas.ref(NUMERO));

  assert.equal(read?.id, NUMERO);
  assert.deepEqual(asked.one, [`/facturas/${NUMERO}`]);
});

test("a new record reads only its model, asked of the list with one row — as useRecord asks it", async () => {
  const { transport, asked } = spied();

  const read = await readRecordOnServer(transport, facturas, "");

  assert.equal(read?.id, "");
  assert.equal(read?.record, null);
  assert.equal(read?.meta?.aggregate, "Factura");
  assert.deepEqual(asked.one, []);
  assert.deepEqual(asked.list, [
    { route: "/facturas", criteria: { pagination: { limit: 1 } } },
  ]);
});

test("it reads through the screens' use case: traced like the browser's reads", async () => {
  const tracer = memoryTracer();
  configureProcess({ tracer });

  await readRecordOnServer(memoryTransport(VENTAS), facturas, NUMERO);

  const screens = tracer.spans.filter((span) => span.name.startsWith("screens/"));
  assert.equal(screens.length, 1, tracer.spans.map((span) => span.name).join(", "));
});

test("a refusal answers nothing and one line that says its kind, never its message", async () => {
  const logs = memoryLogger();
  configureProcess({ logger: { engine: logs } });

  assert.equal(
    await readRecordOnServer(memoryTransport(VENTAS), facturas, "F-404"),
    undefined,
  );

  const lines = notRead(logs);
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.level, "warn");
  assert.deepEqual(lines[0]?.attributes, {
    what: "ventas:factura",
    "error.type": "TransportError",
    "error.kind": "not_found",
  });
});

test("an unexpected failure says its message, under the name the page gave it", async () => {
  const logs = memoryLogger();
  configureProcess({ logger: { engine: logs } });
  const broken: Transport = {
    ...memoryTransport(VENTAS),
    one: () => Promise.reject(new TypeError("fetch failed")),
  };

  const read = await readRecordOnServer(broken, facturas, NUMERO, {
    what: "the invoice page",
  });

  assert.equal(read, undefined);
  assert.deepEqual(notRead(logs)[0]?.attributes, {
    what: "the invoice page",
    "error.type": "TypeError",
    "error.kind": "internal",
    "error.message": "fetch failed",
  });
});

test("a read the caller aborted answers nothing, without a line: nobody waits for the page", async () => {
  const logs = memoryLogger();
  configureProcess({ logger: { engine: logs } });
  const aborter = new AbortController();
  setTimeout(() => aborter.abort(), 5);

  const read = await readRecordOnServer(
    memoryTransport(VENTAS, { latency: 50 }),
    facturas,
    NUMERO,
    { signal: aborter.signal },
  );

  assert.equal(read, undefined);
  assert.deepEqual(notRead(logs), []);
});

test("started from it, the record screen renders on the server FILLED — its values, not a skeleton — and asks nothing", async () => {
  const { transport, asked } = spied();
  const initial = await readRecordOnServer(transport, facturas, NUMERO);

  const html = onServer(transport, <FacturaPage opened={NUMERO} initial={initial} />);

  assert.ok(!html.includes("Cargando la factura"), "no skeleton");
  assert.ok(html.includes(NUMERO), "its number");
  assert.ok(html.includes("Publicada"), "its state, in the model's words");
  assert.ok(
    html.includes("VISA-4004"),
    "the card reference its hint shows when paid by card",
  );
  // An instant on the business's wall clock (La Paz), whatever zone the server runs in.
  assert.ok(html.includes("05/01/2026 10:14"), "created, at 10:14 in La Paz");
  assert.deepEqual(asked.one, [`/facturas/${NUMERO}`], "only the server's read");
});

test("without it, a record screen renders on the server as today: a skeleton, nothing asked", () => {
  const { transport, asked } = spied();

  const html = onServer(transport, <FacturaPage opened={NUMERO} />);

  assert.ok(html.includes("Cargando la factura"));
  assert.ok(!html.includes(NUMERO));
  assert.deepEqual(asked, { one: [], list: [] });
});

test("what was read for another record is never shown — another id, another entity", async () => {
  const { transport } = spied();
  const initial = await readRecordOnServer(transport, facturas, NUMERO);
  // The same table under another key: the same id, but not what the screen opens.
  const otras = entity<Factura>("ventas:otra", { list: "/facturas" });
  function OtraPage() {
    const otra = useRecord(otras, NUMERO, { initial: initial as RecordRead<Factura> });
    return <p>{otra.status}</p>;
  }

  const another = onServer(transport, <FacturaPage opened="F-2026-0006" initial={initial} />);
  const elsewhere = onServer(transport, <OtraPage />);

  assert.ok(another.includes("Cargando la factura"));
  assert.ok(!another.includes(NUMERO));
  assert.equal(elsewhere, "<p>loading</p>");
});

test("a kept draft comes back with it, as the browser's read brings it: restored, its values typed", async () => {
  const transport = memoryTransport(VENTAS, {
    draft: () => ({ version: 2, origin_version: 1, values: { notes: "A medias" } }),
  });
  const initial = await readRecordOnServer(transport, facturas, NUMERO);
  function Restaurada() {
    const factura = useRecord(facturas, NUMERO, { initial });
    const { edit } = factura;
    return (
      <p>{`${factura.status}:${edit.restored}:${edit.dirty}:${String(edit.values["notes"])}`}</p>
    );
  }

  assert.equal(onServer(transport, <Restaurada />), "<p>ready:true:true:A medias</p>");
});

test("a new record starts from its model's defaults and what its reference carries", async () => {
  const { transport } = spied();
  const initial = await readRecordOnServer(transport, facturas, "");

  const html = onServer(
    transport,
    <FacturaPage opened={facturas.newRef({ notes: "Pedido de la web" })} initial={initial} />,
  );

  assert.ok(!html.includes("Cargando la factura"));
  assert.ok(html.includes("Nueva factura"));
  assert.ok(html.includes("Borrador"), "the state's default, in the model's words");
  assert.ok(html.includes("Efectivo"), "the payment's default");
  assert.ok(html.includes("Pedido de la web"), "what the reference carries");
});

test("its model goes into the provider's metas: what renders after it knows the entity", async () => {
  const { transport } = spied();
  const initial = await readRecordOnServer(transport, facturas, NUMERO);
  function Known() {
    const { metas } = useFramework();
    return <p>{metas.get(facturas.key)?.aggregate ?? "unknown"}</p>;
  }

  const seeded = onServer(
    transport,
    <>
      <FacturaPage opened={NUMERO} initial={initial} />
      <Known />
    </>,
  );
  const unseeded = onServer(
    transport,
    <>
      <FacturaPage opened={NUMERO} />
      <Known />
    </>,
  );

  assert.ok(seeded.endsWith("<p>Factura</p>"));
  assert.ok(unseeded.endsWith("<p>unknown</p>"));
});

test("the framework's record screen starts from it too: EntityRecord drawn filled on the server", async () => {
  const { transport, asked } = spied();
  const initial = await readRecordOnServer(transport, facturas, NUMERO);
  const page = createTestApi(facturas.ref(NUMERO));
  const screen = (read?: RecordRead<Factura>) => (
    <EntityRecord api={page.api} resource={page.api.self} entity={facturas} initial={read} />
  );

  const filled = onServer(transport, screen(initial));
  const skeleton = onServer(transport, screen());

  assert.ok(!filled.includes("Cargando el registro"), "no skeleton");
  for (const said of [NUMERO, "Publicada", "VISA-4004", "05/01/2026 10:14"])
    assert.ok(filled.includes(said), said);
  // Without it, as today: the skeleton, and nothing asked while rendering.
  assert.ok(skeleton.includes("Cargando el registro"));
  assert.ok(!skeleton.includes("VISA-4004"));
  assert.deepEqual(asked.one, [`/facturas/${NUMERO}`], "only the server's read");
});

test("with the business's zone installed, the server's HTML is the same whatever zone it runs in", async () => {
  const { transport } = spied();
  const initial = await readRecordOnServer(transport, facturas, NUMERO);
  const page = createTestApi(facturas.ref(NUMERO));
  const host = process.env["TZ"];
  const screen = (
    <EntityRecord
      api={page.api}
      resource={page.api.self}
      entity={facturas}
      initial={initial}
    />
  );
  // What the browser hydrates against: its own zone, which the server does not know.
  const renderedIn = (zone: string, installed: boolean) => {
    process.env["TZ"] = zone;
    return installed
      ? onServer(transport, screen)
      : renderToString(
          <FrameworkProvider transport={transport} locale="es">
            {screen}
          </FrameworkProvider>,
        );
  };
  try {
    const utc = renderedIn("UTC", true);
    const tokyo = renderedIn("Asia/Tokyo", true);

    assert.ok(utc.includes("05/01/2026 10:14"), "La Paz's wall clock");
    assert.equal(tokyo, utc);
    // Without it, each host writes the instant on its own clock: the HTML would not match.
    assert.ok(renderedIn("UTC", false).includes("05/01/2026 14:14"));
    assert.ok(renderedIn("Asia/Tokyo", false).includes("05/01/2026 23:14"));
  } finally {
    if (host === undefined) delete process.env["TZ"];
    else process.env["TZ"] = host;
  }
});
