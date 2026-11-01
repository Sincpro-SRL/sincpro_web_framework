"use client";

import type { AnyRecord } from "@sincpro/criteria";
import { labelOf, nameOf } from "@sincpro/criteria";
import { useCrumbs, type ViewProps } from "@sincpro/web-composer";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { type Entity, TRAIL_PARAM } from "@sincpro/web-framework/core/entity";
import { formOf } from "@sincpro/web-framework/core/form";
import { placeOf, stepIn } from "@sincpro/web-framework/core/trail";
import { useFramework } from "@sincpro/web-framework/react/context";
import { useHistory } from "@sincpro/web-framework/react/useHistory";
import { type RecordReading, useRecord } from "@sincpro/web-framework/react/useRecord";
import { useSummaryOf } from "@sincpro/web-framework/react/useSummary";
import { dirtyOf, RecordField } from "@sincpro/web-framework/web/record/edit";
import { Refused } from "@sincpro/web-framework/web/Refused";
import { useRecordInWorkspace } from "@sincpro/web-framework/web/workspace/workspace";
import { Button, Callout, Record, Skeleton } from "@sincpro/web-ui";
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
  const reading = useRecord(entity, resource.id ?? "");
  const crumbs = useCrumbs(api);
  useRecordInWorkspace(api, reading);
  const history = useHistory(entity, reading.isNew ? "" : reading.id, [reading.record]);
  const summarize = useSummaryOf(entity);
  const [page, setPage] = useState<string | undefined>(undefined);
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

  if (reading.status === "loading") return <Skeleton rows={6} label={copy.loading} />;
  if (reading.status === "failed")
    return <Refused error={reading.error} onRetry={reading.reload} />;

  const { meta, locale, edit } = reading;
  const layout = formOf(meta, entity.summary);
  const shown = fields ?? layout.fields;
  const tabs = pages ?? layout.pages;
  const summary = reading.isNew ? undefined : summarize(reading.record, meta);
  const dirty = dirtyOf(reading);
  const created = summary?.created;
  const updated = summary?.updated;
  const stamp = (one: { at: string | null; by: string | null } | undefined) =>
    one?.at == null ? undefined : { at: one.at, by: one.by ?? "—" };
  const createdStamp = stamp(created);
  const updatedStamp = stamp(updated);
  // Moving away with something typed would lose it: «save / discard» comes first.
  const place =
    trail === undefined || reading.isNew || edit.dirty ? null : placeOf(trail, reading.id);

  return (
    <Record
      identity={{
        title: summary?.name ?? copy.creating(nameOf(meta, locale) || ""),
        ...(summary?.type == null ? {} : { subtitle: summary.type }),
        ...(summary?.state == null ? {} : { tag: { label: summary.state } }),
      }}
      {...(dirty === undefined ? {} : { dirty })}
      {...(edit.failure === null ? {} : { error: String((edit.failure as Error).message) })}
    >
      <Record.Rail>
        {crumbs.length === 0 ? null : <Record.Crumbs crumbs={crumbs} />}
        {place === null ? null : (
          <Record.Pager
            index={place.index}
            total={place.total}
            onPrev={go(-1)}
            onNext={go(1)}
          />
        )}
        {/* Always there on an edited record: without them web-ui remounts the paper the moment
            something is typed (AGENTS.md). */}
        <Record.Actions>{actions?.(reading) ?? null}</Record.Actions>
      </Record.Rail>
      <Record.Paper layout="horizontal">
        <div className="flex flex-col gap-3 p-4">
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
          {shown.map((name) => (
            <RecordField key={name} record={reading} name={name} />
          ))}
          {edit.advice.map((one) => (
            <Callout key={one.text} tone="info" title={one.text}>
              {null}
            </Callout>
          ))}
        </div>
        {tabs.length === 0 || reading.isNew ? null : (
          <Record.Pages current={page ?? tabs[0]} onChange={setPage}>
            {tabs.map((name) => (
              <Record.Page key={name} id={name} label={labelOf(meta, name, locale)}>
                <RecordField record={reading} name={name} bare />
              </Record.Page>
            ))}
          </Record.Pages>
        )}
        {createdStamp === undefined && updatedStamp === undefined ? null : (
          <Record.Audit
            {...(createdStamp === undefined ? {} : { created: createdStamp })}
            {...(updatedStamp === undefined ? {} : { updated: updatedStamp })}
          />
        )}
      </Record.Paper>
      {history === undefined ? null : <Record.Activity events={history} />}
    </Record>
  );
}
