import type { DockAction } from "@sincpro/web-ui";
import { isValidElement, type ReactNode } from "react";

/**
 * A screen's actions: as DATA — web-ui's `DockAction`s, which the application's view style
 * draws (the bar's buttons in `traditional`, one pill floating at the bottom in `modern`) — or
 * drawn by hand, a node that stays where it is put.
 *
 *     actions={[{ id: "import", label: "Importar", icon: Upload, onSelect: importar }]}
 *     actions={<ImportarColegiados />}       // its own dialog: drawn by hand, in the bar
 */
export type ScreenActions = readonly DockAction[] | ReactNode;

/** One action as data: an object with its id and its words, not an element. */
function isDockAction(one: unknown): one is DockAction {
  return (
    typeof one === "object" &&
    one !== null &&
    !isValidElement(one) &&
    "id" in one &&
    "label" in one
  );
}

/**
 * The actions split by who draws them: `dock`, the ones given as data, for the view style;
 * `drawn`, a node drawn by hand, to put where it goes — `null` when there is none.
 */
export function actionsOf(actions: ScreenActions): {
  dock: readonly DockAction[];
  drawn: ReactNode;
} {
  if (actions === undefined || actions === null || actions === false)
    return { dock: [], drawn: null };
  if (Array.isArray(actions) && actions.every(isDockAction))
    return { dock: actions, drawn: null };
  return { dock: [], drawn: actions as ReactNode };
}
