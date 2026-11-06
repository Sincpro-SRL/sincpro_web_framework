import type { AnyRecord } from "@sincpro/criteria";
import type {
  CommandAnswers,
  CommandBodies,
  Entity,
} from "@sincpro/web-framework/core/entity";
import { isList, type ListDefinition } from "@sincpro/web-framework/core/list";
import type { PickerItem, RecordCard, RowOf } from "@sincpro/web-ui";
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

export type Presentation<T> = {
  option?: (record: T) => OptionLook;
  row?: (record: T) => RowLook;
  card?: (record: T) => CardLook;
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

/** `look` over `base`, leaving out what `look` sets to `undefined`: «no tags» is not a hole. */
export function over<B extends object, L extends object>(base: B, look: L | undefined): B {
  if (look === undefined) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(look)) if (value !== undefined) out[key] = value;
  return out as B;
}
