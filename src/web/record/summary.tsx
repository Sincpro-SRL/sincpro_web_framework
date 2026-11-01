import { frameworkCopy } from "@sincpro/web-framework/core/copy";
import type { RecordSummary } from "@sincpro/web-framework/core/summary";
import { type RecordCard, type RelationValueProps, Tag } from "@sincpro/web-ui";
import type { ComponentProps } from "react";

/**
 * A record's summary as the props of web-ui's pieces that draw one record at a size: the card
 * of a board and the link (with the card that floats from it) of a many2one.
 *
 * Context: PROPS, not wrapper components — the same reason as `factsOf`/`columnsOf`: web-ui
 * finds its pieces by type inside a list or a board, and a component of ours around one is not
 * found. The screen keeps writing `<RecordCard {...cardOf(s)} onOpen={…} />`, and adds or
 * overrides whatever it wants. What the record does not have is left out, never drawn empty.
 */

type CardProps = ComponentProps<typeof RecordCard>;
type RelationProps = Pick<RelationValueProps, "name" | "secondary" | "media" | "summary">;

function lastChange(summary: RecordSummary): string | null {
  const copy = frameworkCopy().summary;
  const { created, updated } = summary;
  if (updated.at !== null) return copy.updatedLine(updated.at, updated.by);
  return created.at === null ? null : copy.createdLine(created.at, created.by);
}

/** The board's card: the state above, the name, what it is, its description, its last change. */
export function cardOf(summary: RecordSummary): CardProps {
  const footer = lastChange(summary);
  return {
    title: summary.name,
    ...(summary.type === null ? {} : { subtitle: summary.type }),
    ...(summary.state === null ? {} : { tags: <Tag tone="neutral">{summary.state}</Tag> }),
    ...(summary.description === null ? {} : { meta: summary.description }),
    ...(summary.image === null ? {} : { media: { src: summary.image, alt: summary.name } }),
    ...(footer === null
      ? {}
      : { footer: <span className="text-micro text-muted">{footer}</span> }),
  };
}

/**
 * A many2one read: the name, what it is beside it, its face, and the card that floats from the
 * name with its state and when it was made and last changed.
 */
export function relationOf(summary: RecordSummary): RelationProps {
  const copy = frameworkCopy().summary;
  const facts = [
    ...(summary.created.at === null
      ? []
      : [{ label: copy.created, value: copy.when(summary.created.at, summary.created.by) }]),
    ...(summary.updated.at === null
      ? []
      : [{ label: copy.updated, value: copy.when(summary.updated.at, summary.updated.by) }]),
  ];
  const media = summary.person
    ? { person: true as const, ...(summary.image === null ? {} : { src: summary.image }) }
    : summary.image === null
      ? undefined
      : { src: summary.image, alt: summary.name };
  const secondary = summary.type ?? (summary.id === summary.name ? null : summary.id);
  const card = {
    ...(summary.state === null ? {} : { tag: { label: summary.state } }),
    ...(facts.length === 0 ? {} : { facts }),
  };
  return {
    name: summary.name,
    ...(secondary === null ? {} : { secondary }),
    ...(media === undefined ? {} : { media }),
    ...(Object.keys(card).length === 0 ? {} : { summary: card }),
  };
}
