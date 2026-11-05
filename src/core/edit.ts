import {
  type AnyRecord,
  type Expression,
  type FieldError,
  matches,
  type Meta,
  valueOf,
} from "@sincpro/criteria";

/**
 * What an edit is, as plain functions: the state of each field and what changed.
 *
 * Context: sincpro_framework publishes form HINTS on each field — `readonly`, `required`, and
 * `readonly_when` / `required_when` / `visible_when` as criteria conditions over the record —
 * and says they are evaluated «with the same evaluator a client filters with». So a field's
 * state is `matches(values, condition, meta)` over what is on screen NOW: typing «card» in the
 * payment makes «card reference» required at once, with no round trip. A `Preview` from the
 * server, when the entity has one, refines it — the server's word wins.
 *
 * Hints are defaults for a screen, never protection: the server keeps whatever rule matters.
 */
export type FieldState = { readonly: boolean; required: boolean; visible: boolean };

/**
 * What a server preview said about a field. A list of records — an invoice's lines — carries
 * each one's own in `items`, by the line: its identity, or its position for a line that has
 * none (sincpro_framework's `FieldState.items`).
 */
export type ServerFieldState = Partial<FieldState> & {
  items?: Readonly<Record<string, Readonly<Record<string, ServerFieldState>>>>;
};
export type FieldStates = Readonly<Record<string, ServerFieldState>>;

/** What the server's preview warned about, pointing where it belongs (`path`: the field, or a
 *  line's cell — `["lines", "0192…", "price"]`, the line by its identity, by its position when
 *  it has none). It refuses nothing. sincpro_framework's warning. */
export type Advice = {
  message: string;
  field?: string | null;
  path?: readonly (string | number)[];
  /** The rule that said it (`Sale.delivery_when_confirmed`), when one did. */
  rule?: string | null;
  /** A rule the save enforces (`@check`): the save will be refused while it holds. */
  blocks_save?: boolean;
};

/**
 * What a change of `name` moves, computed here when every field it reaches says how
 * (`computes`, the formula the server published): each in the order the server runs them, a
 * computation of a computation reading the one before. `undefined` when one of them does not
 * say — the server's preview answers it — or the change reaches nothing.
 *
 *     computedLocally(saleMeta, { subtotal: "25.30", discount: "1.5" }, "discount")
 *       ->  { total: "22.105" }
 */
export function computedLocally(
  meta: Meta | null | undefined,
  values: AnyRecord,
  name: string,
): AnyRecord | undefined {
  const reached = meta?.fields[name]?.affects ?? [];
  if (meta == null || reached.length === 0) return undefined;
  const working: AnyRecord = { ...values };
  const moved: AnyRecord = {};
  for (const one of reached) {
    const formula = meta.fields[one]?.computes;
    if (formula === undefined || formula === null) return undefined;
    working[one] = valueOf(formula, working);
    moved[one] = working[one];
  }
  return moved;
}

/**
 * Whether a change of `name` needs the server's preview: when the model says what each change
 * reaches (`affects`, `judged_by` — sincpro_framework publishes them in the contract), only a
 * field that reaches something does; a model that says nothing of it is always asked.
 */
export function needsPreview(meta: Meta | null | undefined, name: string): boolean {
  const fields = Object.values(meta?.fields ?? {});
  const says = fields.some((one) => one.affects !== undefined || one.judged_by !== undefined);
  if (!says) return true;
  const field = meta?.fields[name];
  return (field?.affects?.length ?? 0) > 0 || (field?.judged_by?.length ?? 0) > 0;
}

function holds(values: AnyRecord, condition: unknown, meta: Meta): boolean {
  if (condition === null || condition === undefined) return false;
  return matches(values, condition as Expression, meta);
}

export function fieldStateOf(
  meta: Meta | null | undefined,
  name: string,
  values: AnyRecord,
  fromServer?: FieldStates,
): FieldState {
  const field = meta?.fields[name];
  const own: FieldState =
    field === undefined || meta == null
      ? { readonly: false, required: false, visible: true }
      : {
          readonly: (field.readonly ?? false) || holds(values, field.readonly_when, meta),
          required: (field.required ?? false) || holds(values, field.required_when, meta),
          visible:
            field.visible_when === null || field.visible_when === undefined
              ? true
              : holds(values, field.visible_when, meta),
        };
  // `items` is the lines' own word, read with `lineStatesOf` — never a state of the field.
  const { items: _lines, ...server } = fromServer?.[name] ?? {};
  return { ...own, ...server };
}

/**
 * The states the server said of one line of a list of records: under the line's identity —
 * the same line wherever it moved — or under its position when it has none.
 */
export function lineStatesOf(
  fromServer: FieldStates | undefined,
  name: string,
  line: AnyRecord | undefined,
  index: number,
  identity: string,
): FieldStates | undefined {
  const items = fromServer?.[name]?.items ?? {};
  const own = line?.[identity];
  const named =
    own === undefined || own === null || own === "" ? undefined : items[String(own)];
  return named ?? items[String(index)];
}

/**
 * Where the server names a line in a path, most specific first: `lines/0192…` by its identity,
 * `lines/2` by its position — an error, a warning and a state are looked for under each.
 */
export function linePlacesOf(
  name: string,
  line: AnyRecord,
  index: number,
  identity: string,
): string[] {
  const own = line[identity];
  return own === undefined || own === null || own === ""
    ? [`${name}/${index}`]
    : [`${name}/${String(own)}`, `${name}/${index}`];
}

/** The fields whose value differs from the record's — what a save or a draft sends. */
export function changesOf(record: AnyRecord, values: AnyRecord): AnyRecord {
  const changed: AnyRecord = {};
  for (const [name, value] of Object.entries(values))
    if (JSON.stringify(value) !== JSON.stringify(record[name])) changed[name] = value;
  return changed;
}

/** What is missing before it can be saved: a required, visible, editable field left empty. */
export function missingOf(
  meta: Meta | null | undefined,
  values: AnyRecord,
  fromServer?: FieldStates,
): string[] {
  if (!meta) return [];
  return Object.keys(meta.fields).filter((name) => {
    const state = fieldStateOf(meta, name, values, fromServer);
    const value = values[name];
    const empty =
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);
    return state.required && state.visible && !state.readonly && empty;
  });
}

/**
 * Where the server's word points inside the record, as one key: `"discount"`, `"lines/1/qty"`.
 * A JSON pointer (RFC 6901), bare (`/discount`) or as a fragment (`#/values/lines/1/qty`) — the
 * command's `values/` envelope dropped, `~1`/`~0` read back — or a path (`["lines", 1, "qty"]`).
 * Errors and warnings are read with the same rule, so both land on the same cell.
 */
export function pathOf(at: string | readonly (string | number)[]): string {
  if (typeof at !== "string") return at.map(String).join("/");
  const segments = at
    .replace(/^#/, "")
    .replace(/^\//, "")
    .split("/")
    .map((one) => one.replace(/~1/g, "/").replace(/~0/g, "~"));
  if (segments[0] === "values" && segments.length > 1) segments.shift();
  return segments.join("/");
}

/**
 * The server's word on what did not validate, by where it points (`pathOf`): a field's own
 * error under its name, a line's cell's under its whole path (`lines/1/qty`). The first word for
 * a place wins. `errorAt` reads a field's, its lines' included.
 */
export function errorsByField(
  errors: readonly FieldError[] | undefined,
): Record<string, string> {
  const found: Record<string, string> = {};
  for (const error of errors ?? []) {
    const at = pathOf(error.pointer);
    if (at !== "" && found[at] === undefined) found[at] = error.detail;
  }
  return found;
}

/** The error at `at` or under it (`lines` finds `lines/1/qty`): what marks a field invalid. */
export function errorAt(
  errors: Readonly<Record<string, string>>,
  at: string,
): string | undefined {
  const own = errors[at];
  if (own !== undefined) return own;
  const under = Object.keys(errors).find((key) => key.startsWith(`${at}/`));
  return under === undefined ? undefined : errors[under];
}

/** The warnings at `at` or under it — a line's (`lines/1`) finds its cells'. One with no path
 *  is placed by its field. */
export function adviceAt(advice: readonly Advice[], at: string): Advice[] {
  return advice.filter((one) => {
    const key =
      one.path !== undefined && one.path.length > 0 ? pathOf(one.path) : (one.field ?? "");
    return key === at || key.startsWith(`${at}/`);
  });
}

/**
 * A record that does not exist yet: the defaults the model publishes for each field
 * (`FieldMeta.default`, sincpro_framework's `defaults_of`), and nothing else.
 *
 *     defaultsOf(invoiceMeta)  ->  { state: "draft", payment: "cash", discount: "0" }
 */
export function defaultsOf(meta: Meta | null | undefined): AnyRecord {
  const values: AnyRecord = {};
  for (const [name, field] of Object.entries(meta?.fields ?? {}))
    if (field.default !== null && field.default !== undefined) values[name] = field.default;
  return values;
}

/**
 * What a create sends: every value on screen the caller may write. A field the model marks
 * `readonly` is the server's to fill (the number, the totals), and an empty one is left for
 * the server's own default — never sent as `""`.
 *
 * Context: only the model's fixed `readonly` counts, never a `readonly_when`: a currency chosen
 * and then locked by the lines added after it is still the record's currency, and a key written
 * when creating and never after (a tenant's slug) is a `readonly_when` the backend publishes for
 * the stored record. Both travel.
 */
export function creationOf(meta: Meta | null | undefined, values: AnyRecord): AnyRecord {
  const sent: AnyRecord = {};
  for (const [name, value] of Object.entries(values)) {
    if (meta?.fields[name]?.readonly === true) continue;
    if (value === undefined || value === null || value === "") continue;
    sent[name] = value;
  }
  return sent;
}
