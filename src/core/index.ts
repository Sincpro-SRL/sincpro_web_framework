/**
 * The plain logic: no React, no DOM, no design system — so it is tested in Node, fast, with
 * no browser. The transport, the entity, the model definition and what a value reads as.
 * `make doctor` keeps it that way.
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
  changesOf,
  creationOf,
  defaultsOf,
  errorsByField,
  type FieldState,
  fieldStateOf,
  type FieldStates,
  missingOf,
} from "@sincpro/web-framework/core/edit";
export {
  type Entity,
  entity,
  type EntityRef,
  type EntityRoutes,
  NEW_PARAM,
  pathFor,
  PICK_PARAM,
  type WriteRoute,
  writeRoute,
} from "@sincpro/web-framework/core/entity";
export { type HistoryEntry, historyOf } from "@sincpro/web-framework/core/history";
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
export {
  type MemoryOptions,
  type MemoryTable,
  memoryTransport,
} from "@sincpro/web-framework/core/memory";
export {
  defineMeta,
  field,
  type FieldOptions,
  type MetaSpec,
  type Words,
} from "@sincpro/web-framework/core/meta";
export { type MetaStore, metaStore } from "@sincpro/web-framework/core/metas";
export {
  BOOKKEEPING,
  defaultFields,
  type FieldView,
  sortKeyOf,
  textOf,
  viewOf,
} from "@sincpro/web-framework/core/present";
export { type Related, relatedOf } from "@sincpro/web-framework/core/related";
export { type RestOptions, restTransport, urlOf } from "@sincpro/web-framework/core/rest";
export { type RetryKeys, retryKeys, unanswered } from "@sincpro/web-framework/core/retry";
export {
  completeMeta,
  type JsonSchema,
  metaFromSchema,
  type SchemaComponents,
} from "@sincpro/web-framework/core/schema";
export {
  type Draft,
  explain,
  type Method,
  type One,
  type SendOptions,
  type Transport,
  TransportError,
} from "@sincpro/web-framework/core/transport";
