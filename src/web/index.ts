/**
 * The web bindings: what draws a `Listing` and a record with `@sincpro/web-ui`.
 */
export { type ColumnOptions, columnsOf } from "@sincpro/web-framework/web/list/columns";
export { EntityList, type EntityListProps } from "@sincpro/web-framework/web/list/EntityList";
export { EntitySearchBar } from "@sincpro/web-framework/web/list/EntitySearchBar";
export { groupableOf, pilesOf } from "@sincpro/web-framework/web/list/groups";
export {
  type RowCommand,
  type RowCommands,
  useRowCommands,
} from "@sincpro/web-framework/web/list/rowCommands";
export { facetsOf, modelOf } from "@sincpro/web-framework/web/list/search";
export { CommandButton } from "@sincpro/web-framework/web/record/CommandButton";
export {
  dirtyOf,
  type FieldControl,
  RecordField,
} from "@sincpro/web-framework/web/record/edit";
export { EntityPicker } from "@sincpro/web-framework/web/record/EntityPicker";
export { countOf, factsOf, RecordLines } from "@sincpro/web-framework/web/record/record";
export { RelatedList } from "@sincpro/web-framework/web/record/RelatedList";
export { Refused } from "@sincpro/web-framework/web/Refused";
export {
  entityView,
  type EntityViewOptions,
  listView,
  type ListViewOptions,
} from "@sincpro/web-framework/web/workspace/composer";
export { SincproApp } from "@sincpro/web-framework/web/workspace/SincproApp";
export { webUiSkin } from "@sincpro/web-framework/web/workspace/skin";
export {
  chooserIn,
  useFollowed,
  useRecordInWorkspace,
} from "@sincpro/web-framework/web/workspace/workspace";
