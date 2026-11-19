"use client";

import { SelectionTooLarge } from "@sincpro/client-framework";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import { explain } from "@sincpro/web-framework/core/explain";
import type { BatchCommandState } from "@sincpro/web-framework/react/useBatchCommand";
import { Button, Callout, ProgressBar } from "@sincpro/web-ui";

/**
 * A Command running once per record, drawn: how far it is while it runs, then what became of
 * each — «2 hechos · 1 falló», every failure named by its record and its reason, «Reintentar los
 * que fallaron». Before it starts, why it did not: too many chosen.
 *
 *     const confirm = useBatchCommand(invoices, "confirm");
 *     <BatchProgress batch={confirm} />
 *
 * Context: a batch's result is one outcome per record, and a person needs the ones that failed —
 * by name, with the server's reason —, not a count. web-ui draws (`ProgressBar`, `Callout`); the
 * words are the framework's copy, the reasons the server's (`explain`).
 */
export function BatchProgress<R>({
  batch,
}: {
  batch: Pick<
    BatchCommandState<R>,
    "running" | "progress" | "result" | "error" | "retry" | "stop" | "reset"
  >;
}) {
  const copy = frameworkCopy().batch;
  const { running, progress, result, error } = batch;

  if (running && progress !== null)
    return (
      <div className="flex items-center gap-3">
        <ProgressBar
          label={copy.running}
          value={progress.settled}
          maxValue={progress.total}
          valueLabel={copy.progress(progress.settled, progress.total)}
          tone="brand"
        />
        <Button role="ghost" size="sm" onClick={batch.stop}>
          {copy.stop}
        </Button>
      </div>
    );

  if (error instanceof SelectionTooLarge)
    return (
      <Callout tone="warn" onDismiss={batch.reset}>
        {copy.tooMany(error.size, error.limit)}
      </Callout>
    );
  if (error !== null && error !== undefined) {
    const { heading, sentence } = explain(error);
    return (
      <Callout tone="bad" title={heading} onDismiss={batch.reset}>
        {sentence}
      </Callout>
    );
  }

  if (result === null || result.outcomes.length === 0) return null;
  const left = result.outcomes.filter((one) => one.status !== "done");
  return (
    <Callout
      tone={left.length === 0 ? "good" : result.done === 0 ? "bad" : "warn"}
      title={copy.outcome(result.done, result.failed, result.skipped)}
      onDismiss={batch.reset}
      {...(left.length === 0
        ? {}
        : {
            action: (
              <Button role="secondary" size="sm" onClick={() => void batch.retry()}>
                {copy.retry}
              </Button>
            ),
          })}
    >
      {left.length === 0 ? null : (
        <ul className="flex flex-col gap-1">
          {left
            .filter((one) => one.status === "failed")
            .map((one) => (
              <li key={one.item}>
                <span className="font-medium">{one.item}</span>
                {" — "}
                {explain(one.error).sentence}
              </li>
            ))}
        </ul>
      )}
    </Callout>
  );
}
