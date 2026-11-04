import {
  type AnyRecord,
  type Expression,
  type FieldError,
  matches,
  type Meta,
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
 * each one's own in `items`, in the order the form sent them (sincpro_framework's
 * `FieldState.items`).
 */
export type ServerFieldState = Partial<FieldState> & {
  items?: readonly Readonly<Record<string, ServerFieldState>>[];
};
export type FieldStates = Readonly<Record<string, ServerFieldState>>;

/** What the server's preview warned about, pointing where it belongs (`path`: the field, or a
 *  line's cell — `["lines", 1, "price"]`). It refuses nothing. sincpro_framework's warning. */
export type Advice = {
  message: string;
  field?: string | null;
  path?: readonly (string | number)[];
};

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

/** Each line's states of a list of records, as the server said them — by position. */
export function lineStatesOf(
  fromServer: FieldStates | undefined,
  name: string,
): readonly FieldStates[] {
  return fromServer?.[name]?.items ?? [];
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
 * What a create sends: every value on screen the caller may write. A field read-only for THIS
 * new record is the server's to fill (the number, the totals), and an empty one is left for
 * the server's own default — never sent as `""`.
 *
 * Context: read-only is decided as the form decides it (`fieldStateOf`): the model's `readonly`,
 * its `readonly_when` over the new record, and the server's own word for it (a preview's
 * `states`). A key a person writes when creating and never after — a tenant's slug — is a
 * `readonly_when` the new record does not meet: the form let it be typed, so it travels. Only
 * the static `readonly` dropped it before, whatever the form had shown.
 */
export function creationOf(
  meta: Meta | null | undefined,
  values: AnyRecord,
  fromServer?: FieldStates,
): AnyRecord {
  const sent: AnyRecord = {};
  for (const [name, value] of Object.entries(values)) {
    if (
      meta?.fields[name] !== undefined &&
      fieldStateOf(meta, name, values, fromServer).readonly
    )
      continue;
    if (value === undefined || value === null || value === "") continue;
    sent[name] = value;
  }
  return sent;
}
