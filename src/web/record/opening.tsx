"use client";

import type { Entity, EntityRef } from "@sincpro/web-framework/core/entity";
import type { OpenTarget } from "@sincpro/web-ui";
import { createContext, type ReactNode, useContext } from "react";

/**
 * How a record shown in a form opens from here — given by whoever holds the form, used by the
 * fields inside it.
 *
 * Context: a form must work outside a workspace (`web/record/` imports no composer), yet a
 * many2one inside one opens its record in a modal, with «Abrir en…» for the rest. So the form
 * does not decide: the view that holds it says how to open (`entityView` fills it with the
 * composer's `openIn` and the places allowed from where the view is), and a field asks. Without
 * it a related record is a value, not a door.
 */
export type RecordOpening = {
  open: (ref: EntityRef, to: OpenTarget) => void;
  /** Where it may open from here, the default first. */
  targets: readonly OpenTarget[];
  /** «Buscar más…»: the entity's own list opened to choose (in composer, a modal that answers),
   *  on what was typed. Without it the picker brings its own chooser. */
  choose?: (entity: Entity, answer: (id: string) => void, query: string) => void;
};

const Opening = createContext<RecordOpening | null>(null);

export function RecordOpeningProvider({
  value,
  children,
}: {
  value: RecordOpening;
  children: ReactNode;
}) {
  return <Opening.Provider value={value}>{children}</Opening.Provider>;
}

export function useRecordOpening(): RecordOpening | null {
  return useContext(Opening);
}
