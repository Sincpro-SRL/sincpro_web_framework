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
    /** The entity's trash: its archived records (`trashOf`). */
    trash: string;
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
    /** The foot adds up the rows in hand, and they are not the whole set. */
    pageTotals: string;
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
    /** A relation that brought one page of its records: how many it shows, of how many — a
     *  floor when `exact` is false («at least 1000»). */
    partial: (shown: number, total: number, exact?: boolean) => string;
    /** The title of a record that does not exist yet, after the model's name. */
    creating: (name: string) => string;
    /** The list's button that opens the form of a new record. */
    create: string;
    /** A record's one2many: the button that opens the form of a new related record. */
    add: string;
    /** The record's own `Delete` (its dry run is shown before it runs). */
    delete: string;
    /** Into the entity's trash (`Archive`): out of every reading, nothing lost. */
    archive: string;
    /** Out of the trash (`Restore`): read again. */
    restore: string;
  };
  picker: {
    /** The button beside a many2one that opens the chooser over the whole set. */
    browse: string;
    /** The choice of nothing, when a field may be left empty (`EntityPicker none`). */
    none: string;
  };
  summary: {
    /** The facts of a record's summary: when it was made and last changed. */
    created: string;
    updated: string;
    /** «12 mar 2026 · Ana Rojas»: when, and who when it is known. */
    when: (at: string, by: string | null) => string;
    /** A card's last line: «Updated 12 Mar 2026 by Ana», or «Created …» if never changed. */
    updatedLine: (at: string, by: string | null) => string;
    createdLine: (at: string, by: string | null) => string;
    /** A fact of a record's history that carries no label of its own. */
    recorded: string;
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
    /** What each kind of refusal is called — the heading, before the server's own `title`. */
    kind: Record<FailureKind, string>;
    /** What to do next, by kind, when it is the same whatever was refused. A kind left out
     *  (`invalid`, `domain`) keeps the server's `guidance`: only the use case knows what fixes
     *  its own refusal. */
    next: Partial<Record<FailureKind, string>>;
  };
};

export const ENGLISH_FRAMEWORK_COPY: FrameworkCopy = {
  value: {
    yes: "yes",
    no: "no",
    items: (count, exact) => `${count}${exact ? "" : "+"} ${count === 1 ? "item" : "items"}`,
  },
  list: {
    trash: "Trash",
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
    pageTotals: "Totals of this page",
  },
  record: {
    restored: "A draft you kept is back. Save it or discard it.",
    conflict:
      "Someone saved this record after you opened it. Nothing was overwritten: read it again.",
    reload: "Read it again",
    missing: (fields) => `Missing: ${fields.join(", ")}.`,
    keep: "Keep draft",
    loading: "Loading the record",
    partial: (shown, total, exact = true) =>
      `Showing ${shown} of ${exact ? "" : "at least "}${total}.`,
    creating: (name) => (name ? `${name} · new` : "New"),
    create: "New",
    add: "Add",
    delete: "Delete",
    archive: "Move to the trash",
    restore: "Restore",
  },
  picker: {
    browse: "Search all",
    none: "None",
  },
  summary: {
    created: "Created",
    updated: "Updated",
    when: (at, by) => (by === null ? at : `${at} · ${by}`),
    updatedLine: (at, by) => (by === null ? `Updated ${at}` : `Updated ${at} by ${by}`),
    createdLine: (at, by) => (by === null ? `Created ${at}` : `Created ${at} by ${by}`),
    recorded: "Change recorded",
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
    next: {
      permission_denied: "Ask whoever administers it for access.",
      not_found: "It may have been deleted, or the link is old.",
      conflict: "Read it again before changing it.",
      in_progress: "Wait a moment and look again.",
      key_reused: "Read it again to see whether it was done.",
      exhausted: "Wait a moment and try again.",
      unavailable: "Try again in a few minutes.",
      unknown_outcome: "Read it again before repeating it.",
      internal: "If it happens again, report it.",
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
    trash: "Papelera",
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
    pageTotals: "Totales de esta página",
  },
  record: {
    restored: "Volvió un borrador que guardaste. Guardalo o descartalo.",
    conflict:
      "Alguien guardó este registro después de que lo abriste. No se pisó nada: volvé a leerlo.",
    reload: "Volver a leer",
    missing: (fields) => `Falta: ${fields.join(", ")}.`,
    keep: "Guardar borrador",
    loading: "Cargando el registro",
    partial: (shown, total, exact = true) =>
      `Se muestran ${shown} de ${exact ? "" : "al menos "}${total}.`,
    creating: (name) => (name ? `${name} · nuevo` : "Nuevo"),
    create: "Nuevo",
    add: "Agregar",
    delete: "Eliminar",
    archive: "Mover a la papelera",
    restore: "Restaurar",
  },
  picker: {
    browse: "Buscar en todos",
    none: "Ninguno",
  },
  summary: {
    created: "Creado",
    updated: "Actualizado",
    when: (at, by) => (by === null ? at : `${at} · ${by}`),
    updatedLine: (at, by) =>
      by === null ? `Actualizado el ${at}` : `Actualizado el ${at} por ${by}`,
    createdLine: (at, by) => (by === null ? `Creado el ${at}` : `Creado el ${at} por ${by}`),
    recorded: "Cambio registrado",
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
    next: {
      permission_denied: "Pedí acceso a quien lo administra.",
      not_found: "Puede que lo hayan eliminado, o el enlace es viejo.",
      conflict: "Volvé a leerlo antes de cambiarlo.",
      in_progress: "Esperá un momento y volvé a mirar.",
      key_reused: "Volvé a leerlo para ver si se hizo.",
      exhausted: "Esperá un momento y reintentá.",
      unavailable: "Reintentá en unos minutos.",
      unknown_outcome: "Volvé a leerlo antes de repetirlo.",
      internal: "Si vuelve a pasar, avisá a soporte.",
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
