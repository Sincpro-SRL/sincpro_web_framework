import type { AnyRecord, Criteria, Meta, Problem } from "@sincpro/criteria";
import {
  type Draft,
  FrameworkProvider,
  memoryTransport,
  type Method,
  restTransport,
  type Transport,
} from "@sincpro/web-framework";
import { type ReactNode, useMemo, useState } from "react";

import { type Call, restServer } from "./rest";
import { servidorVentas } from "./servidor";

/**
 * Where every use case runs: the in-memory server over the given tables, behind the same
 * provider an application mounts. `latency` keeps «loading» visible the way a real network
 * does; `refuse` makes the server say no.
 */
export function Escenario({
  tables,
  latency = 250,
  refuse,
  handle,
  draft,
  observe,
  metas,
  children,
}: {
  tables: Readonly<Record<string, { meta: Meta; rows: readonly AnyRecord[] }>>;
  latency?: number;
  refuse?: (route: string) => Problem | undefined;
  handle?: (method: Method, route: string, body: unknown) => unknown;
  draft?: (route: string) => Draft | null;
  observe?: (route: string, criteria: Criteria) => void;
  /** Definitions known before any request: the preload. */
  metas?: Readonly<Record<string, Meta>>;
  children: ReactNode;
}) {
  const transport = useMemo(
    () =>
      memoryTransport(tables, {
        latency,
        ...(refuse ? { refuse } : {}),
        ...(handle ? { handle } : {}),
        ...(draft ? { draft } : {}),
        ...(observe ? { observe } : {}),
      }),
    [tables, latency, refuse, handle, draft, observe],
  );
  return (
    <FrameworkProvider transport={transport} locale="es" {...(metas ? { metas } : {})}>
      <div className="min-h-dvh bg-ground p-6">
        <div className="@container overflow-clip rounded-box border border-line-strong bg-surface">
          {children}
        </div>
      </div>
    </FrameworkProvider>
  );
}

/**
 * The same, over HTTP: `restTransport` against the sales service behind sincpro_framework's REST
 * wire (`restServer`). What an app does in production — URLs, envelopes, problem+json, drafts in
 * the record's answer — with only the far end fake. `preparar` sets the service up first.
 */
export function EscenarioRest({
  preparar,
  children,
}: {
  preparar?: (servidor: ReturnType<typeof servidorVentas>) => void;
  children: (wire: {
    servidor: ReturnType<typeof servidorVentas>;
    transport: Transport;
    calls: readonly Call[];
  }) => ReactNode;
}) {
  const [calls, setCalls] = useState<Call[]>([]);
  const wire = useMemo(() => {
    const servidor = servidorVentas();
    preparar?.(servidor);
    // A request is made outside React's render: its record reaches the screen as state.
    const server = restServer(servidor, "/v1", (call) =>
      queueMicrotask(() => setCalls((now) => [...now, call])),
    );
    const transport = restTransport({ base: server.base, fetch: server.fetch });
    return { servidor, transport };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once per story
  }, []);
  return (
    <FrameworkProvider transport={wire.transport} locale="es">
      <div className="min-h-dvh bg-ground p-6">
        <div className="@container overflow-clip rounded-box border border-line-strong bg-surface">
          {children({ ...wire, calls })}
        </div>
      </div>
    </FrameworkProvider>
  );
}
