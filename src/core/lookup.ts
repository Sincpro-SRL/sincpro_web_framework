import type { AnyRecord, Meta } from "@sincpro/criteria";
import { type SummaryFields, summaryFieldsOf } from "@sincpro/web-framework/core/summary";

/**
 * A record as a choice: what a many2one select, a «share with» and ⌘K show for it.
 *
 * Context: sincpro_framework answers this question on its own — `LiteralSearch`, the entity's
 * `DEFAULT_LITERAL_SEARCH` and `DEFAULT_DISPLAY` — and publishes both in the model definition
 * (`meta.search`, `meta.display`). So a choice is read from the model: its key is the field a
 * record is fetched by, its label the display, and the key again beside it when the two differ
 * («Globex Bolivia · C-004»), which is what tells two «Globex» apart. Its picture is the
 * record's summary image (`entity(…, { summary })`): a person is chosen by their face.
 */
export type LookupOption = { id: string; label: string; detail?: string; image?: string };

export function lookupOf(
  meta: Meta | null | undefined,
  rows: readonly AnyRecord[],
  summary: SummaryFields = {},
): LookupOption[] {
  const key = meta?.get_id || meta?.identity || "id";
  const display = meta?.display || key;
  return rows.map((row) => {
    const id = String(row[key] ?? "");
    const shown = row[display];
    const label = shown === undefined || shown === null || shown === "" ? id : String(shown);
    const imageField = summaryFieldsOf(meta, row, summary).image;
    const picture = imageField === undefined ? undefined : row[imageField];
    const image = typeof picture === "string" && picture !== "" ? { image: picture } : {};
    return label === id ? { id, label, ...image } : { id, label, detail: id, ...image };
  });
}
