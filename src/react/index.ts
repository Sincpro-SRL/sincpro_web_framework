/**
 * The state of a list and a record and the gestures that drive them. It draws nothing — no
 * DOM, no design system — so a screen can drop `EntityList` and still keep it. `make doctor`
 * keeps it that way.
 */
export { FrameworkProvider, useFramework } from "@sincpro/web-framework/react/context";
export {
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
export { type Lookup, useLookup } from "@sincpro/web-framework/react/useLookup";
export {
  type Advice,
  type Editing,
  type RecordReading,
  type RecordState,
  useRecord,
} from "@sincpro/web-framework/react/useRecord";
export { useRelated } from "@sincpro/web-framework/react/useRelated";
export { useSummaryOf } from "@sincpro/web-framework/react/useSummary";
