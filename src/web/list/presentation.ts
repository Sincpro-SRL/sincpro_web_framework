import {
  type CommandAnswers,
  type CommandBodies,
  type Entity,
} from "@sincpro/client-framework";
import type { AnyRecord } from "@sincpro/criteria";
import { isList, type ListDefinition } from "@sincpro/web-framework/core/list";
import type { PickerItem, RecordCard, RowOf, Tone } from "@sincpro/web-ui";
import type { ComponentProps } from "react";

/**
 * How a record of an entity looks at each size — a choice, a row, a card — declared ONCE with
 * the entity and used wherever the framework draws one of its records.
 *
 * Context: the name of a record is the backend's (`meta.display`, Odoo's `display_name`) and
 * its parts are the summary's (`entity(…, { summary })`); what was missing is how it is DRAWN.
 * Every place built its own: the picker's option was always name + key + face, the rows face
 * name + three facts, the board's card whatever the row said. Now an application says it once:
 *
 *     export const customers = presented(entity<Customer>("sales:customer", { list: "/customers" }), {
 *       option: (c) => ({ meta: c.tax_id, aside: <Saldo value={c.balance} /> }),
 *       row: (c) => ({ tags: c.blocked ? <Tag tone="bad">Bloqueado</Tag> : undefined }),
 *       card: (c) => ({ subtitle: c.city, figure: <Saldo value={c.balance} /> }),
 *     });
 *
 * Each size answers the PROPS of web-ui's piece for it (`PickerItem`, `RowOf`, `RecordCard`),
 * merged OVER the default: give only what changes, and what is not given stays as it was.
 * Props and not components for the reason `factsOf`/`columnsOf` give: web-ui keeps the
 * keyboard, the highlight of what was typed, the press rule and the accessibility of the
 * piece, and finds its slots by type. A whole component of the application in an option's
 * place needs web-ui to take one (`ROADMAP.md`).
 *
 * A function around `entity()` and not a field of it: `core/` draws nothing and cannot name a
 * React node; the presentation is the web's, so it is added here. The result IS the entity —
 * every place that takes one takes it — with its presentation on board.
 */

/** A choice in a many2one, a many2many and ⌘K. ⌘K writes only text: `name` and `meta`. */
export type OptionLook = Partial<Omit<PickerItem, "id">>;
/** A row of the «rows» face — and of the board's card when there is no `card`. */
export type RowLook = Partial<RowOf>;
/** The board's card. Opening it stays the list's: `onOpen` is not the presentation's. */
export type CardLook = Partial<Omit<ComponentProps<typeof RecordCard>, "onOpen">>;

/** The colour of each value of a choice, by field and by value as text (the Meta's own keys):
 *  `{ estado: { APROBADO: "good", RECHAZADO: "bad" } }`. */
export type ChoiceTones<T> = Readonly<
  Partial<Record<keyof T & string, Readonly<Record<string, Tone>>>>
>;

export type Presentation<T> = {
  option?: (record: T) => OptionLook;
  row?: (record: T) => RowLook;
  card?: (record: T) => CardLook;
  /**
   * The colour of each value of a choice — a state, a priority. Declared once here and used
   * wherever the framework draws the value: a table's cell, a row's and a card's tag, the tag of
   * the record's header. A value with no tone is a neutral tag; the word is always the Meta's.
   *
   * Context: which colour «Rechazado» is, is the client's decision — the backend says what a
   * value is called, never how it looks — and nothing here held it: every application kept a
   * dictionary per state and passed it to its rows, its record and its cells by hand.
   */
  tones?: ChoiceTones<T>;
  /** The colour of each kind of fact in its history, by its `name` — whole, or its last part
   *  (`pago_aprobado`) — over the framework's own (`FACT_TONES`). */
  facts?: Readonly<Record<string, Tone>>;
  /** The fields a table of its records shows when the screen names none — on its own list and
   *  inside another record (a one2many) alike. Without it, every field but the stamps. */
  columns?: readonly (keyof T & string)[];
  /**
   * How the parts its records hold look — the rows of a relation with no entity of its own (an
   * issue's runs, a tenant's members), by the relation's name, typed by the part:
   *
   *     presented(issues, { tones: { status: ISSUE_TONE }, parts: { runs: { tones: { status: RUN_TONE } } } })
   *
   * Context: a part has no route, so there is no `presented(runs, …)` to declare it with; its
   * look belongs to the record that holds it. Declared here, every place that draws those rows
   * reads it — `RecordLines`, the lines editor, a `RecordField` — and a screen passes its own
   * only to change it.
   */
  parts?: PartLooks<T>;
};

/** How a record's part looks: what `Presentation` says of an entity, for a row it holds. */
export type PartLook<P> = Pick<Presentation<P>, "tones" | "columns">;

/** The record a field holds many of — an `EntityCollection<Run>`, a `Run[]` — or `never`. */
export type PartOf<V> = unknown extends V
  ? AnyRecord
  : NonNullable<V> extends { readonly items: readonly (infer P)[] }
    ? P
    : NonNullable<V> extends readonly (infer P)[]
      ? P
      : never;

/** A part's look by the name of the field that holds it — only fields that hold many. */
export type PartLooks<T> = {
  readonly [K in keyof T & string as [PartOf<T[K]>] extends [never] ? never : K]?: PartLook<
    PartOf<T[K]>
  >;
};

export type Presented<
  T extends AnyRecord,
  C extends CommandBodies = CommandBodies,
  A extends CommandAnswers = CommandAnswers,
> = Entity<T, C, A> & {
  readonly presentation: Presentation<T>;
};

/** The entity with how its records look: pass it wherever an entity goes. */
export function presented<
  T extends AnyRecord,
  C extends CommandBodies = CommandBodies,
  A extends CommandAnswers = CommandAnswers,
>(entity: Entity<T, C, A>, presentation: Presentation<T>): Presented<T, C, A> {
  // Its typed Commands and answers go with it: a generated entity, presented, is still checked.
  return { ...entity, presentation };
}

/** The presentation an entity — or the entity of a named list — was declared with; none is `{}`. */
export function presentationOf<T extends AnyRecord>(
  source: Entity<T> | ListDefinition<T>,
): Presentation<T> {
  const base = isList(source) ? source.entity : source;
  return "presentation" in base ? (base as Presented<T>).presentation : {};
}

/** How the parts an entity's records hold under `name` look; `{}` when it declares nothing. */
export function partLookOf(
  entity: Entity | ListDefinition<AnyRecord> | undefined,
  name: string,
): PartLook<AnyRecord> {
  if (entity === undefined) return {};
  const parts = presentationOf(entity).parts as
    Readonly<Record<string, PartLook<AnyRecord> | undefined>> | undefined;
  return parts?.[name] ?? {};
}

/**
 * The tones of each layer over the one before, value by value — the entity's, then a part's
 * declaration, then the screen's: a screen that colours `failed` keeps the declared `done`.
 * `undefined` when no layer says anything.
 */
export function tonesOver<T>(
  ...layers: readonly (ChoiceTones<T> | undefined)[]
): ChoiceTones<T> | undefined {
  const said = layers.filter((one): one is ChoiceTones<T> => one !== undefined);
  if (said.length === 0) return undefined;
  if (said.length === 1) return said[0];
  const out: Record<string, Readonly<Record<string, Tone>>> = {};
  for (const layer of said)
    for (const [field, tones] of Object.entries(layer) as [string, Record<string, Tone>][])
      out[field] = { ...out[field], ...tones };
  return out as ChoiceTones<T>;
}

/** `look` over `base`, leaving out what `look` sets to `undefined`: «no tags» is not a hole. */
export function over<B extends object, L extends object>(base: B, look: L | undefined): B {
  if (look === undefined) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(look)) if (value !== undefined) out[key] = value;
  return out as B;
}
