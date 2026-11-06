/**
 * The plain logic of the screens: no React, no DOM, no design system — so it is tested in Node,
 * fast, with no browser. What a value reads as, what a form sends, how lines are edited, a
 * record's place in its list, a failure in a person's words. `make doctor` keeps it that way.
 *
 * Context: the transport, the entity, the client contract and the model definitions are
 * @sincpro/client-framework's — the same on every platform — and are imported from there.
 */
export {
  type CachedTransport,
  cachedTransport,
  type CacheOptions,
} from "@sincpro/web-framework/core/cache";
export {
  ENGLISH_FRAMEWORK_COPY,
  type FrameworkCopy,
  frameworkCopy,
  installFrameworkCopy,
  SPANISH_FRAMEWORK_COPY,
} from "@sincpro/web-framework/core/copy";
export {
  type Advice,
  adviceAt,
  changesOf,
  computedLocally,
  creationOf,
  defaultsOf,
  errorAt,
  errorsByField,
  type FieldState,
  fieldStateOf,
  type FieldStates,
  linePlacesOf,
  lineStatesOf,
  missingOf,
  needsPreview,
  pathOf,
  type ServerFieldState,
} from "@sincpro/web-framework/core/edit";
export { explain } from "@sincpro/web-framework/core/explain";
export { type FormLayout, formOf } from "@sincpro/web-framework/core/form";
export { type HistoryEntry, historyOf } from "@sincpro/web-framework/core/history";
export {
  addingOf,
  type AddingRule,
  blankLine,
  type Declared,
  editableLines,
  type LineAdding,
  lineFields,
  lineKey,
  linesAnswered,
  moved,
  sameLine,
  writtenInCell,
} from "@sincpro/web-framework/core/lines";
export {
  defineList,
  type GroupLevel,
  isList,
  type ListDefinition,
  type ListSpec,
  type NamedFilter,
  scopeOf,
} from "@sincpro/web-framework/core/list";
export { lookupOf, type LookupOption } from "@sincpro/web-framework/core/lookup";
export { detailOf, measuresOf, sumsOf } from "@sincpro/web-framework/core/measure";
export {
  BOOKKEEPING,
  defaultFields,
  type FieldView,
  sortKeyOf,
  textOf,
  viewOf,
} from "@sincpro/web-framework/core/present";
export { type Related, relatedOf } from "@sincpro/web-framework/core/related";
export {
  entityFor,
  type RelationField,
  relationFieldOf,
} from "@sincpro/web-framework/core/relation";
export {
  type RecordSummary,
  summaryFieldsOf,
  summaryOf,
} from "@sincpro/web-framework/core/summary";
export { placeOf, stepIn, type Trail } from "@sincpro/web-framework/core/trail";
export {
  installTimeZone,
  instantOf,
  timeZoneNow,
  wallTimeOf,
} from "@sincpro/web-framework/core/zone";
