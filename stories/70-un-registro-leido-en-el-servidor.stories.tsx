import { restTransport, type Transport } from "@sincpro/client-framework";
import { createTestApi } from "@sincpro/web-composer";
import {
  dirtyOf,
  EntityRecord,
  FrameworkProvider,
  readRecordOnServer,
  RecordField,
  type RecordRead,
  type RecordReading,
  Refused,
  useRecord,
} from "@sincpro/web-framework";
import { Record, Skeleton } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { type Call, restServer } from "./support/rest";
import { servidorVentas } from "./support/servidor";
import { clientes, type Factura, facturas } from "./support/ventas";

const meta: Meta = {
  title: "Casos de uso/70 · Un registro leído en el servidor",
  parameters: {
    docs: {
      description: {
        component:
          "Una página dibujada en el **servidor** (Next.js, cualquier SSR) llega con el registro **ya lleno** en su HTML, no con un esqueleto. El servidor lee el registro y su modelo con `readRecordOnServer(transport, entidad, id)` —lo mismo que `useRecord` pregunta en el navegador, como JSON plano— y la página empieza de eso: `useRecord(entidad, id, { initial })`. El navegador **hidrata** ese HTML sin diferencias y **no vuelve a pedir** el registro al montar; editar, el preview, guardar y los borradores siguen siendo del navegador, como siempre.\n\nAquí el «servidor» es `renderToString` con su propio transporte, y el navegador, `hydrateRoot` con otro, los dos contra la misma API. Abajo, lo que viajó por el cable y de parte de quién.\n\nLa página instala la **zona** del negocio y el **idioma** (`FrameworkProvider timeZone locale`): sin ellos, una hora se escribe en la zona del servidor y después en la del navegador, y el HTML no coincide.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** A draft invoice paid by card: every kind of field — a choice, a day, an instant, a number,
 *  words, yes/no, its customer and its lines — and all of it editable. */
const NUMERO = "F-2026-0001";

/** Which record screen the page draws: one of the application's own (`useRecord`), or the
 *  framework's (`EntityRecord`, through `useRecordScreen`). */
type Pantalla = "propia" | "framework";

/** The page, the same on the server and in the browser: the provider an application mounts,
 *  in the business's zone and language, and a record screen. */
function Pagina({
  transport,
  pantalla,
  initial,
  alHidratar,
}: {
  transport: Transport;
  pantalla: Pantalla;
  initial?: RecordRead<Factura> | undefined;
  /** In the browser only: told once the page is mounted. It draws nothing. */
  alHidratar?: () => void;
}) {
  const hidratada = useRef(alHidratar);
  useEffect(() => hidratada.current?.(), []);
  return (
    <FrameworkProvider
      transport={transport}
      locale="es"
      timeZone="America/La_Paz"
      entities={[clientes, facturas]}
    >
      {pantalla === "propia" ? (
        <FacturaLeida initial={initial} />
      ) : (
        <FacturaDelFramework initial={initial} />
      )}
    </FrameworkProvider>
  );
}

function FacturaLeida({ initial }: { initial?: RecordRead<Factura> | undefined }) {
  const factura = useRecord(facturas, NUMERO, { initial });
  return <Formulario factura={factura} />;
}

/** The framework's record screen, as a workspace opens it on a page — here with composer's
 *  `createTestApi`, the workspace a view is tested without. */
function FacturaDelFramework({ initial }: { initial?: RecordRead<Factura> | undefined }) {
  const [pagina] = useState(() => createTestApi(facturas.ref(NUMERO)));
  return (
    <EntityRecord
      api={pagina.api}
      resource={pagina.api.self}
      entity={facturas}
      initial={initial}
    />
  );
}

function Formulario({ factura }: { factura: RecordReading<Factura> }) {
  const dirty = dirtyOf(factura);
  if (factura.status === "loading") return <Skeleton rows={6} label="Cargando la factura" />;
  if (factura.status === "failed")
    return <Refused error={factura.error} onRetry={factura.reload} />;
  return (
    <Record
      identity={{ title: factura.record.number, subtitle: factura.record.customer.name }}
      {...(dirty === undefined ? {} : { dirty })}
    >
      <Record.Paper layout="horizontal">
        <div className="grid max-w-3xl grid-cols-2 gap-3 p-4">
          {[
            "customer",
            "state",
            "invoice_date",
            "due_date",
            "payment",
            "card_reference",
            "discount",
            "tags",
            "notes",
            "urgent",
            "amount_total",
            "created_at",
          ].map((name) => (
            <RecordField key={name} record={factura} name={name} />
          ))}
        </div>
        <RecordField record={factura} name="lines" />
      </Record.Paper>
    </Record>
  );
}

/** What a server hands its page crosses as text: the browser receives a copy, never an object. */
const cruzado = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The server's HTML, kept as it arrived: the play reads it before hydration touched it. */
let servido = "";

/**
 * A server-rendered page's life, in one place: the API (the sales service, over its REST wire),
 * the server — its own transport reads the invoice and draws the page —, and the browser — its
 * own transport, hydrating that HTML. It says whether React found any difference, and what
 * travelled, from whom.
 */
function DelServidorAlNavegador({
  leer,
  pantalla = "propia",
  navegar = false,
}: {
  leer: boolean;
  pantalla?: Pantalla;
  /** A navigation inside the application (Next's client-side one): the page comes as what the
   *  server read, without HTML, and the browser draws it itself — mounted twice in StrictMode. */
  navegar?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [cable, setCable] = useState<readonly (Call & { quien: string })[]>([]);
  const [diferencias, setDiferencias] = useState<readonly string[] | null>(null);
  const [esqueleto, setEsqueleto] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (el === null) return;
    let quien = "servidor";
    const api = restServer(servidorVentas(), "/v1", (call) => {
      const dicho = { ...call, quien };
      queueMicrotask(() => setCable((now) => [...now, dicho]));
    });
    const pagina = document.createElement("div");
    const vistas: string[] = [];
    const visto = (said: unknown) => {
      vistas.push(said instanceof Error ? said.message : String(said));
      setDiferencias([...vistas]);
    };
    // React says an attribute that differs only on the console, in development.
    const decir = console.error;
    console.error = (...args: unknown[]) => {
      if (args.some((one) => /hydrat/i.test(String(one)))) visto(args.join(" "));
      decir(...args);
    };
    let raiz: Root | null = null;
    let vivo = true;
    // Whether the page ever showed its skeleton, however briefly.
    const mirando = new MutationObserver(() => {
      if (/Cargando (la factura|el registro)/.test(pagina.textContent ?? ""))
        setEsqueleto(true);
    });
    mirando.observe(pagina, { childList: true, subtree: true, characterData: true });

    void (async () => {
      // The server: its transport, its read, its render.
      const delServidor = restTransport({ base: api.base, fetch: api.fetch });
      const leido = leer
        ? await readRecordOnServer(delServidor, facturas, NUMERO)
        : undefined;
      servido = navegar
        ? ""
        : renderToString(
            <StrictMode>
              <Pagina transport={delServidor} pantalla={pantalla} initial={leido} />
            </StrictMode>,
          );
      if (!vivo) return;
      pagina.innerHTML = servido;
      el.append(pagina);
      // The browser: its own transport, the same API, what the server handed the page.
      quien = "navegador";
      const delNavegador = restTransport({ base: api.base, fetch: api.fetch });
      // In StrictMode, at the root, as Next.js renders in development: React mounts a page the
      // browser draws twice, and the second mount must not read what the server read either.
      const enElNavegador = (
        <StrictMode>
          <Pagina
            transport={delNavegador}
            pantalla={pantalla}
            initial={leido === undefined ? undefined : cruzado(leido)}
            alHidratar={() => setDiferencias([...vistas])}
          />
        </StrictMode>
      );
      if (navegar) {
        raiz = createRoot(pagina);
        raiz.render(enElNavegador);
      } else raiz = hydrateRoot(pagina, enElNavegador, { onRecoverableError: visto });
    })();

    return () => {
      vivo = false;
      mirando.disconnect();
      console.error = decir;
      /* After: unmounting another root while React unmounts this one is a race. */
      setTimeout(() => {
        raiz?.unmount();
        pagina.remove();
      });
    };
  }, [leer, pantalla, navegar]);

  return (
    <div className="grid gap-3 p-4">
      <p role="status" className="text-meta text-muted">
        {diferencias === null
          ? "Hidratando…"
          : diferencias.length > 0
            ? `Difiere del servidor: ${diferencias.join(" · ")}`
            : navegar
              ? "Dibujado en el navegador"
              : "Hidratado sin diferencias con el servidor"}
        {esqueleto ? " · pasó por el esqueleto" : ""}
      </p>
      <div ref={host} />
      <ol aria-label="Lo que viajó" className="font-mono text-micro text-muted">
        {cable.map((call, i) => (
          <li key={i}>
            {call.quien}: {call.method} {decodeURIComponent(call.url).slice(0, 90)}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Every request of the record itself, by whoever asked. */
const delRegistro = (cable: HTMLElement, quien: string) =>
  within(cable)
    .queryAllByRole("listitem")
    .filter((item) => item.textContent === `${quien}: GET /v1/facturas/${NUMERO}`);

/** Read on the server: the HTML arrives filled, the browser hydrates it without a difference and
 *  asks nothing for it — and then it is edited and saved there, as always. */
export const LlegaLleno: Story = {
  render: () => <DelServidorAlNavegador leer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent(
        "Hidratado sin diferencias con el servidor",
      ),
    );
    // The server's HTML, before the browser touched it: the record, not a skeleton — an instant
    // on La Paz's clock, a day, the card's reference, its words, its lines.
    await expect(servido).not.toContain("Cargando la factura");
    for (const said of [NUMERO, "VISA-4000", "exportación", "01/01/2026 10:10", "Tarjeta"])
      await expect(servido).toContain(said);

    const cable = canvas.getByLabelText("Lo que viajó");
    await expect(delRegistro(cable, "servidor")).toHaveLength(1);
    // Hydrated: on screen as it came, and nothing asked for it on mount.
    await expect(canvas.getByRole("textbox", { name: "Nota" })).toBeVisible();
    await expect(canvas.queryByText("Cargando la factura")).toBeNull();
    await new Promise((done) => setTimeout(done, 400));
    await expect(delRegistro(cable, "navegador")).toHaveLength(0);
    await expect(canvas.getByRole("status")).toHaveTextContent(
      /^Hidratado sin diferencias con el servidor$/,
    );

    // In the browser it is the record it always was: typed, previewed, saved and read again.
    await userEvent.type(canvas.getByRole("textbox", { name: "Nota" }), "Llamar antes");
    await userEvent.click(await canvas.findByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(canvas.queryByRole("button", { name: "Guardar" })).toBeNull());
    await expect(canvas.getByRole("textbox", { name: "Nota" })).toHaveValue("Llamar antes");
    await waitFor(() =>
      expect(cable).toHaveTextContent(`navegador: PUT /v1/facturas/${NUMERO}`),
    );
    await waitFor(() => expect(delRegistro(cable, "navegador")).toHaveLength(1));
  },
};

/** Not read on the server — what every page did before: the skeleton in the HTML, the same on
 *  hydrating, and the browser reads the record on mount. */
export const SinLeerloLlegaElEsqueleto: Story = {
  render: () => <DelServidorAlNavegador leer={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent(
        "Hidratado sin diferencias con el servidor",
      ),
    );
    await expect(servido).toContain("Cargando la factura");
    await expect(servido).not.toContain("VISA-4000");
    const cable = canvas.getByLabelText("Lo que viajó");
    await expect(await canvas.findByRole("textbox", { name: "Nota" })).toBeVisible();
    await expect(delRegistro(cable, "servidor")).toHaveLength(0);
    // Read on mount — twice in StrictMode, as in development: the first one is aborted.
    await waitFor(() => expect(delRegistro(cable, "navegador").length).toBeGreaterThan(0));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Hidratado sin diferencias con el servidor",
    );
  },
};

/** The framework's own record screen (`EntityRecord`): drawn filled on the server — its name,
 *  its state, its fields, who made it and when — and hydrated without a difference. */
export const LaPantallaDelFrameworkTambien: Story = {
  render: () => <DelServidorAlNavegador leer pantalla="framework" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent(
        "Hidratado sin diferencias con el servidor",
      ),
    );
    await expect(servido).not.toContain("Cargando el registro");
    for (const said of [NUMERO, "Borrador", "VISA-4000", "exportación", "01/01/2026 10:10"])
      await expect(servido).toContain(said);
    await expect(await canvas.findByRole("textbox", { name: "Nota" })).toBeVisible();
    const cable = canvas.getByLabelText("Lo que viajó");
    await expect(delRegistro(cable, "servidor")).toHaveLength(1);
    // Its history is the browser's to read; the record is not asked again.
    await waitFor(() =>
      expect(cable).toHaveTextContent(`navegador: GET /v1/facturas/${NUMERO}/events`),
    );
    await expect(delRegistro(cable, "navegador")).toHaveLength(0);
    await expect(canvas.getByRole("status")).toHaveTextContent(
      /^Hidratado sin diferencias con el servidor$/,
    );
  },
};

/** A navigation inside the application: no HTML, what the server read comes as data and the
 *  browser draws the page with it — filled from its first frame, never the skeleton, and nothing
 *  asked for the record, though StrictMode mounts the page twice. */
export const AlNavegarSinEsqueleto: Story = {
  render: () => <DelServidorAlNavegador leer navegar />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("Dibujado en el navegador"),
    );
    await expect(await canvas.findByRole("textbox", { name: "Nota" })).toBeVisible();
    const cable = canvas.getByLabelText("Lo que viajó");
    await expect(delRegistro(cable, "servidor")).toHaveLength(1);
    await new Promise((done) => setTimeout(done, 400));
    await expect(delRegistro(cable, "navegador")).toHaveLength(0);
    await expect(canvas.getByRole("status")).toHaveTextContent(/^Dibujado en el navegador$/);
  },
};
