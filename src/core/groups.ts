import type { Bucket } from "@sincpro/criteria";
import { frameworkCopy } from "@sincpro/web-framework/core/copy";

/**
 * Whether an answer to a grouped question holds groups — each with how many records it holds
 * (`count`) and the criteria that opens it, its levels below too.
 *
 * Context: a backend that does not group answers records to the same question (sincpro_framework
 * before 3.37.1, a fake that never learned), and a record read as a group has no `count`: web-ui's
 * table fell over drawing it, and drawing «—» instead would show N empty groups that look valid
 * (web-ui decided so in Sincpro-SRL/sincpro_web_ui#33). So the answer is checked here, once, and
 * a list that got no groups says so in its failed state.
 */
export function areGroups(rows: readonly unknown[]): rows is readonly Bucket[] {
  return rows.every((row) => {
    if (typeof row !== "object" || row === null) return false;
    const bucket = row as Partial<Bucket>;
    return (
      typeof bucket.count === "number" &&
      typeof bucket.criteria === "object" &&
      bucket.criteria !== null &&
      (bucket.groups === undefined || areGroups(bucket.groups))
    );
  });
}

/** What a grouped question was answered with when it was not groups: the list's failure. */
export class NotGrouped extends Error {
  constructor(readonly route: string) {
    super(frameworkCopy().list.notGrouped);
    this.name = "NotGrouped";
  }
}
