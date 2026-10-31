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

/** What a server preview said about a field. */
export type FieldStates = Readonly<Record<string, Partial<FieldState>>>;

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
  return { ...own, ...fromServer?.[name] };
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

/** The server's word on a field that did not validate: `errors[].pointer` is a JSON pointer. */
export function errorsByField(
  errors: readonly FieldError[] | undefined,
): Record<string, string> {
  const found: Record<string, string> = {};
  for (const error of errors ?? []) {
    const name = error.pointer.replace(/^\/(values\/)?/, "").split("/")[0] ?? "";
    if (name !== "" && found[name] === undefined) found[name] = error.detail;
  }
  return found;
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
 */
export function creationOf(meta: Meta | null | undefined, values: AnyRecord): AnyRecord {
  const sent: AnyRecord = {};
  for (const [name, value] of Object.entries(values)) {
    const field = meta?.fields[name];
    if (field?.readonly === true) continue;
    if (value === undefined || value === null || value === "") continue;
    sent[name] = value;
  }
  return sent;
}
