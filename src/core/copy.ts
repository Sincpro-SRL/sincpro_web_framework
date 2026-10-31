import type { FailureKind } from "@sincpro/criteria";

/**
 * Every word the framework writes on its own, in one table — the way `@sincpro/web-ui` and the
 * composer do it. English by default; an application installs its language ONCE with
 * `installFrameworkCopy`, and nothing carries a hard-coded string.
 *
 * Context: it lives in `core/` and not next to the components because a value is turned into
 * text here («sí», «3 elementos»), and a cell, a fact and a chip must read it the same.
 */
export type FrameworkCopy = {
  value: {
    yes: string;
    no: string;
    /** A one2many/many2many cell: how many there are, `exact: false` meaning «at least». */
    items: (count: number, exact: boolean) => string;
  };
  list: {
    loadMore: string;
    loading: string;
    /** «12 of 120»: what is on screen against what matches. */
    shown: (shown: number, total: number, exact: boolean) => string;
    empty: string;
    emptyFiltered: string;
    search: string;
    /** The search bar, which also takes `#` to pick a field. */
    searchBar: string;
    /** The title of the criteria builder's window. */
    builder: string;
    /** `more` mode reached its ceiling: what is on screen, and what to do instead. */
    capped: (shown: number) => string;
    /** Conditions the server could not answer: the list is WIDER than asked. */
    dropped: (fields: readonly string[]) => string;
    /** The group of the records that hold no value in the field grouped by. */
    noValue: string;
    /** More groups than shown: narrow the set instead of scrolling them. */
    groupsCapped: (shown: number) => string;
    /** «12 groups · 187 records»: what the grouping split. */
    groups: (groups: number, records: number) => string;
  };
  record: {
    /** A draft this caller kept is back on screen. */
    restored: string;
    /** Someone saved it after it was read: nothing was overwritten. */
    conflict: string;
    reload: string;
    /** What is missing before it can be saved. */
    missing: (fields: readonly string[]) => string;
    keep: string;
    loading: string;
    /** Under an embedded list the record holds only one page of. */
    partial: (shown: number, total: number) => string;
    /** The title of a record that does not exist yet, after the model's name. */
    creating: (name: string) => string;
    /** The list's button that opens the form of a new record. */
    create: string;
  };
  picker: {
    /** The button beside a many2one that opens the chooser over the whole set. */
    browse: string;
  };
  command: {
    /** The confirmation of an action that cannot be undone, after its dry run. */
    confirm: string;
    cancel: string;
    /** While the dry run is asked. */
    rehearsing: string;
  };
  failure: {
    /** The server could not be reached at all — nothing it said is known. */
    unreachable: string;
    /** It answered with a status and no problem to read. */
    status: (status: number) => string;
    retry: string;
    /** What each kind of refusal is called when the server sent no title of its own. */
    kind: Record<FailureKind, string>;
  };
};

export const ENGLISH_FRAMEWORK_COPY: FrameworkCopy = {
  value: {
    yes: "yes",
    no: "no",
    items: (count, exact) => `${count}${exact ? "" : "+"} ${count === 1 ? "item" : "items"}`,
  },
  list: {
    loadMore: "Load more",
    loading: "Loading…",
    shown: (shown, total, exact) => `${shown} of ${total}${exact ? "" : "+"}`,
    empty: "Nothing here yet.",
    emptyFiltered: "Nothing matches.",
    search: "Search",
    searchBar: "Search, or # to pick a field…",
    builder: "Criteria builder",
    capped: (shown) => `Showing the first ${shown}. Narrow the search to see the rest.`,
    dropped: (fields) =>
      `The server ignored a condition on ${fields.join(", ")}: the list shows more than asked.`,
    noValue: "No value",
    groupsCapped: (shown) => `The first ${shown} groups. Narrow the search to see the rest.`,
    groups: (groups, records) =>
      `${groups} ${groups === 1 ? "group" : "groups"} · ${records} ${records === 1 ? "record" : "records"}`,
  },
  record: {
    restored: "A draft you kept is back. Save it or discard it.",
    conflict:
      "Someone saved this record after you opened it. Nothing was overwritten: read it again.",
    reload: "Read it again",
    missing: (fields) => `Missing: ${fields.join(", ")}.`,
    keep: "Keep draft",
    loading: "Loading the record",
    partial: (shown, total) => `Showing ${shown} of ${total}.`,
    creating: (name) => (name ? `${name} · new` : "New"),
    create: "New",
  },
  picker: {
    browse: "Search all",
  },
  command: {
    confirm: "Do it",
    cancel: "Cancel",
    rehearsing: "Checking what it would do…",
  },
  failure: {
    unreachable: "The server could not be reached",
    status: (status) => `The server answered ${status}`,
    retry: "Retry",
    kind: {
      invalid: "The request is not valid",
      unauthenticated: "Sign in again",
      permission_denied: "You do not have access",
      not_found: "It does not exist",
      conflict: "Someone changed it first",
      in_progress: "It is still in progress",
      key_reused: "That request was already sent",
      domain: "The operation was refused",
      exhausted: "Too many requests",
      unavailable: "The service is not available",
      unknown_outcome: "It is not known whether it was done",
      internal: "Something failed on the server",
    },
  },
};

export const SPANISH_FRAMEWORK_COPY: FrameworkCopy = {
  value: {
    yes: "sí",
    no: "no",
    items: (count, exact) =>
      `${count}${exact ? "" : "+"} ${count === 1 ? "elemento" : "elementos"}`,
  },
  list: {
    loadMore: "Cargar más",
    loading: "Cargando…",
    shown: (shown, total, exact) => `${shown} de ${total}${exact ? "" : "+"}`,
    empty: "Todavía no hay nada.",
    emptyFiltered: "Nada coincide.",
    search: "Buscar",
    searchBar: "Buscar, o # para elegir el campo…",
    builder: "Constructor de criteria",
    capped: (shown) =>
      `Se muestran los primeros ${shown}. Refiná la búsqueda para ver el resto.`,
    dropped: (fields) =>
      `El servidor ignoró una condición sobre ${fields.join(", ")}: la lista muestra más de lo pedido.`,
    noValue: "Sin valor",
    groupsCapped: (shown) =>
      `Los primeros ${shown} grupos. Acotá la búsqueda para ver el resto.`,
    groups: (groups, records) =>
      `${groups} ${groups === 1 ? "grupo" : "grupos"} · ${records} ${records === 1 ? "registro" : "registros"}`,
  },
  record: {
    restored: "Volvió un borrador que guardaste. Guardalo o descartalo.",
    conflict:
      "Alguien guardó este registro después de que lo abriste. No se pisó nada: volvé a leerlo.",
    reload: "Volver a leer",
    missing: (fields) => `Falta: ${fields.join(", ")}.`,
    keep: "Guardar borrador",
    loading: "Cargando el registro",
    partial: (shown, total) => `Se muestran ${shown} de ${total}.`,
    creating: (name) => (name ? `${name} · nuevo` : "Nuevo"),
    create: "Nuevo",
  },
  picker: {
    browse: "Buscar en todos",
  },
  command: {
    confirm: "Hacerlo",
    cancel: "Cancelar",
    rehearsing: "Revisando qué haría…",
  },
  failure: {
    unreachable: "No se pudo hablar con el servidor",
    status: (status) => `El servidor respondió ${status}`,
    retry: "Reintentar",
    kind: {
      invalid: "El pedido no es válido",
      unauthenticated: "Volvé a iniciar sesión",
      permission_denied: "No tenés acceso",
      not_found: "No existe",
      conflict: "Alguien lo cambió antes",
      in_progress: "Todavía está en curso",
      key_reused: "Ese pedido ya se envió",
      domain: "La operación fue rechazada",
      exhausted: "Demasiados pedidos",
      unavailable: "El servicio no está disponible",
      unknown_outcome: "No se sabe si se hizo",
      internal: "Algo falló en el servidor",
    },
  },
};

let installed: FrameworkCopy = ENGLISH_FRAMEWORK_COPY;

/** Install the framework's words once, where the application starts. */
export function installFrameworkCopy(copy: FrameworkCopy): void {
  installed = copy;
}

/** The words in use. A plain read: they are installed before anything draws. */
export const frameworkCopy = (): FrameworkCopy => installed;
