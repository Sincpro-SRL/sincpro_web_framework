"use client";

import { type Entity, TRAIL_PARAM } from "@sincpro/client-framework";
import type { AnyRecord } from "@sincpro/criteria";
import { labelOf, nameOf } from "@sincpro/criteria";
import { useCrumbs, type ViewProps } from "@sincpro/web-composer";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { explain } from "@sincpro/web-framework/core/explain";
import { formOf } from "@sincpro/web-framework/core/form";
import { placeOf, stepIn } from "@sincpro/web-framework/core/trail";
import { useFramework } from "@sincpro/web-framework/react/context";
import { useHistory } from "@sincpro/web-framework/react/useHistory";
import { type RecordReading, useRecord } from "@sincpro/web-framework/react/useRecord";
import { useSummaryOf } from "@sincpro/web-framework/react/useSummary";
import { dirtyOf, RecordField } from "@sincpro/web-framework/web/record/edit";
import { Refused } from "@sincpro/web-framework/web/Refused";
import { useRecordInWorkspace } from "@sincpro/web-framework/web/workspace/workspace";
import { Button, Callout, FormSection, Record, Skeleton } from "@sincpro/web-ui";
import { type ReactNode, useState } from "react";

/**
 * The record of an entity, drawn from its model — the screen `entityView` opens when the
 * application writes none: in the page, a modal, the preview or a panel, the same.
 *
 * Context: every Sincpro record screen was the same hundred lines: read it, tell the workspace
 * its name and its unsaved work, draw its name and state on top, its fields, its lines, the
 * conflict and the restored draft, who made it, its history. Here once, from what the model and
 * the entity already say (`formOf`, `summaryOf`): a new entity has a useful screen before anyone
 * writes it. It is a default, not a cage — `fields`/`pages` choose and order, `actions` puts the
 * record's commands, and any screen can drop this and keep `useRecord` + `RecordField`.
 *
 *     entityView(invoices, { transport, name: "Facturas" })          // this screen
 *     entityView(invoices, { …, record: (props) =>
 *       <EntityRecord {...props} entity={invoices} fields={["customer_id", "due_date"]}
 *         actions={(invoice) => <CommandButton entity={invoices} command="post" … />} /> })
 */
/** A save's refusal as a sentence — its heading when the server gave no detail. */
function refusalOf(failure: unknown): string {
  const said = explain(failure);
  return said.sentence || said.heading;
}

/** Who made a record, or changed it last, and when: `Record.Audit`'s. */
export type Stamp = { at: string; by?: string };

/**
 * What every record screen in a workspace does before drawing its own — what `EntityRecord`
 * does, as values: read the record for editing, follow the workspace's breadcrumb, tell the
 * workspace its name and its unsaved work, read its history, step to its neighbours in the list
 * it was opened from, and say its name, state, unsaved work, refusal and authorship the way
 * web-ui's `Record` takes them.
 *
 *     function InvoiceScreen(props: ViewProps) {
 *       const screen = useRecordScreen(invoices, props);
 *       if (screen.reading.status !== "ready") return <Skeleton rows={6} />;
 *       return (
 *         <Record {...screen.record}>
 *           <Record.Rail>
 *             <Record.Crumbs crumbs={screen.crumbs} />
 *             {screen.pager ? <Record.Pager {...screen.pager} /> : null}
 *           </Record.Rail>
 *           <Record.Paper>…your own fields…</Record.Paper>
 *         </Record>
 *       );
 *     }
 *
 * Context: the level between `EntityRecord` and `useRecord` — a screen of its own keeps every
 * behaviour of the framework's record and writes its own tree. It answers PROPS, never
 * components: web-ui finds a record's regions by type (`Record.Crumbs` a direct child of
 * `Record.Rail`), and a region wrapped in one of ours is not found. Before it, forge's console
 * carried these 150 lines itself (`shared/record_screen.tsx`).
 */
export function useRecordScreen<T extends AnyRecord>(
  entity: Entity<T>,
  { api, resource }: Pick<ViewProps, "api" | "resource">,
) {
  const reading = useRecord(entity, resource);
  const crumbs = useCrumbs(api);
  useRecordInWorkspace(api, reading);
  const history = useHistory(entity, reading.isNew ? "" : reading.id, [reading.record]);
  const summarize = useSummaryOf(entity);
  const copy = frameworkCopy().record;
  // Opened from a list: where it stands in it, and its neighbours (`Trail`).
  const { trails, transport } = useFramework();
  const trailKey = resource.params?.[TRAIL_PARAM];
  const trail = trailKey === undefined ? undefined : trails.get(trailKey);
  const go = (step: 1 | -1) => () => {
    if (trail === undefined || trailKey === undefined) return;
    void stepIn(transport, trail, reading.id, step).then((moved) => {
      if (moved === null) return;
      trails.set(trailKey, moved.trail);
      const ref = entity.ref(moved.id);
      // In place, as Odoo's pager: the neighbour is not a step deeper, no crumb leads back.
      api.replace({ ...ref, params: { ...ref.params, [TRAIL_PARAM]: trailKey } });
    });
  };
  const ready = reading.status === "ready";
  const summary =
    ready && !reading.isNew ? summarize(reading.record, reading.meta) : undefined;
  const dirty = ready ? dirtyOf(reading) : undefined;
  const failure = reading.edit.failure;
  // Who, only when the record says it (an author is optional: the line then says only when).
  const stamp = (
    one: { at: string | null; by: string | null } | undefined,
  ): Stamp | undefined =>
    one?.at == null ? undefined : { at: one.at, ...(one.by == null ? {} : { by: one.by }) };
  const created = stamp(summary?.created);
  const updated = stamp(summary?.updated);
  // Moving away with something typed would lose it: «save / discard» comes first.
  const place =
    trail === undefined || reading.isNew || reading.edit.dirty
      ? null
      : placeOf(trail, reading.id);
  return {
    reading,
    crumbs,
    history,
    summary,
    /** web-ui `Record`'s own props: where it is drawn, its name, its unsaved work, its refusal. */
    record: {
      // Where it is mounted decides the paper, not what the rail carries: crumbs, pager and
      // actions come and go while it is on screen, and the paper flipping with them remounted
      // the form under the field being typed in. A modal is already a card.
      placement: api.surface === "modal" ? ("card" as const) : ("page" as const),
      identity: {
        // A new record is «creating»; an existing one has no name until it is read.
        title:
          summary?.name ??
          (reading.isNew ? copy.creating(nameOf(reading.meta, reading.locale) || "") : ""),
        ...(summary?.type == null ? {} : { subtitle: summary.type }),
        ...(summary?.state == null ? {} : { tag: { label: summary.state } }),
      },
      ...(dirty === undefined ? {} : { dirty }),
      // The refusal in words; its heading when the server said nothing more (no detail).
      ...(failure === null || failure === undefined ? {} : { error: refusalOf(failure) }),
    },
    /** `Record.Pager`'s props, when it was opened from a list and nothing is typed. */
    pager:
      place === null
        ? undefined
        : { index: place.index, total: place.total, onPrev: go(-1), onNext: go(1) },
    /** `Record.Audit`'s props, when the record says who made it or changed it. */
    audit:
      created === undefined && updated === undefined
        ? undefined
        : {
            ...(created === undefined ? {} : { created }),
            ...(updated === undefined ? {} : { updated }),
          },
  };
}

export function EntityRecord<T extends AnyRecord>({
  api,
  resource,
  entity,
  fields,
  pages,
  actions,
}: ViewProps & {
  entity: Entity<T>;
  /** The fields, in this order. Without it, the model's (`formOf`). */
  fields?: readonly string[];
  /** The one2many shown as pages, in this order. Without it, every one the model has. */
  pages?: readonly string[];
  /** The record's own commands, beside «save / discard». */
  actions?: (record: RecordReading<T>) => ReactNode;
}) {
  const screen = useRecordScreen(entity, { api, resource });
  const { reading, crumbs, history, pager } = screen;
  const [page, setPage] = useState<string | undefined>(undefined);
  const copy = frameworkCopy().record;

  if (reading.status === "loading") return <Skeleton rows={6} label={copy.loading} />;
  if (reading.status === "failed")
    return <Refused error={reading.error} onRetry={reading.reload} />;

  const { meta, locale, edit } = reading;
  const layout = formOf(meta, entity.summary);
  const shown = fields ?? layout.fields;
  const ownActions = actions?.(reading) ?? null;
  const tabs = pages ?? layout.pages;

  return (
    <Record {...screen.record}>
      {/* The rail only when it carries something: an empty one is a blank band under the title
          of a modal or a panel. (It used to be needed always — a web-ui remount, fixed.) */}
      {crumbs.length === 0 && pager === undefined && ownActions === null ? null : (
        <Record.Rail>
          {crumbs.length === 0 ? null : <Record.Crumbs crumbs={crumbs} />}
          {pager === undefined ? null : <Record.Pager {...pager} />}
          {ownActions === null ? null : <Record.Actions>{ownActions}</Record.Actions>}
        </Record.Rail>
      )}
      <Record.Paper layout="horizontal">
        {edit.conflict || edit.restored ? (
          <div className="flex flex-col gap-3">
            {edit.conflict ? (
              <Callout tone="warn" title={copy.conflict}>
                <Button size="sm" role="secondary" onClick={reading.reload}>
                  {copy.reload}
                </Button>
              </Callout>
            ) : null}
            {edit.restored ? (
              <Callout tone="info" title={copy.restored}>
                {null}
              </Callout>
            ) : null}
          </div>
        ) : null}
        {/* web-ui's form grid (its «Operación» template): two columns on a page and in a modal,
            one in a side panel, a window or a peek — web-ui's grid does not narrow by itself
            (ROADMAP). A hand-made column left half the sheet empty on a page. */}
        <FormSection columns={api.surface === "page" || api.surface === "modal" ? 2 : 1}>
          {shown.map((name) => (
            <RecordField key={name} record={reading} name={name} />
          ))}
        </FormSection>
        {/* A line's warning goes on its line (`RecordField` of the lines): here, the rest. */}
        {edit.advice
          .filter((one) => (one.path?.length ?? 0) <= 1)
          .map((one) => (
            <Callout key={one.message} tone="info" title={one.message}>
              {null}
            </Callout>
          ))}
        {tabs.length === 0 || reading.isNew ? null : (
          <Record.Pages current={page ?? tabs[0]} onChange={setPage}>
            {tabs.map((name) => (
              <Record.Page key={name} id={name} label={labelOf(meta, name, locale)}>
                <RecordField record={reading} name={name} bare />
              </Record.Page>
            ))}
          </Record.Pages>
        )}
        {screen.audit === undefined ? null : <Record.Audit {...screen.audit} />}
      </Record.Paper>
      {history === undefined ? null : <Record.Activity events={history} />}
    </Record>
  );
}
