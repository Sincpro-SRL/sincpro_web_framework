/**
 * The state of a list and a record and the gestures that drive them. It draws nothing — no
 * DOM, no design system — so a screen can drop `EntityList` and still keep it. `make doctor`
 * keeps it that way.
 */
export {
  FrameworkProvider,
  useEntityFor,
  useFramework,
} from "@sincpro/web-framework/react/context";
export {
  type ListScope,
  ListScopeProvider,
  useListScope,
} from "@sincpro/web-framework/react/scope";
export {
  type AnswerOf,
  type CommandState,
  type Rehearsal,
  useCommand,
} from "@sincpro/web-framework/react/useCommand";
export { type Groups, useGroups } from "@sincpro/web-framework/react/useGroups";
export { useHistory } from "@sincpro/web-framework/react/useHistory";
export {
  type Listing,
  type ListingOptions,
  type Paging,
  useListing,
} from "@sincpro/web-framework/react/useListing";
export { excluding, type Lookup, useLookup } from "@sincpro/web-framework/react/useLookup";
export { useNameOf } from "@sincpro/web-framework/react/useNameOf";
export {
  type PivotAxes,
  type PivotReading,
  usePivot,
} from "@sincpro/web-framework/react/usePivot";
export {
  type Editing,
  type RecordReading,
  type RecordState,
  useRecord,
} from "@sincpro/web-framework/react/useRecord";
export { useRelated } from "@sincpro/web-framework/react/useRelated";
export { type ServiceState, useService } from "@sincpro/web-framework/react/useService";
export { useSummaryOf } from "@sincpro/web-framework/react/useSummary";
