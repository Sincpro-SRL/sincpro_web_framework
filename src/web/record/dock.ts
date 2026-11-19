import type { ActionGesture } from "@sincpro/web-framework/web/record/ActionButton";
import type { DockAction } from "@sincpro/web-ui";
import type { ReactNode } from "react";

/**
 * An action for a dock — web-ui's `Record.Dock` and `List.Dock`, which the application's view
 * style draws: the rail's buttons in `traditional`, one pill floating at the bottom in `modern`
 * — and the window its gesture opens (what it asks, what it would do, a refusal).
 *
 *     const aprobar = useServiceAction({ label: "Aprobar", primary: true, run: aprobarPago });
 *     <Record.Rail>
 *       <Record.Dock actions={[aprobar.action]} />
 *     </Record.Rail>
 *     {aprobar.dialog}
 */
export type DockedAction = {
  action: DockAction;
  /** Put it anywhere on the screen — it opens over everything —; `null` while closed. */
  dialog: ReactNode;
};

/** How an action is drawn in a dock — everything but its words and what it does. Its `id`
 *  defaults to its label. */
export type ActionLook = Pick<
  DockAction,
  "icon" | "primary" | "danger" | "tucked" | "shortcut" | "hint"
> & { id?: string };

/** A look as a hook receives it: a field the screen left out is `undefined`. */
type LookGiven = { [K in keyof ActionLook]?: ActionLook[K] | undefined };

/** The dock's action started by a gesture: off while it runs. */
export function dockedOf(
  gesture: ActionGesture,
  label: string,
  look: LookGiven,
  disabled = false,
): DockedAction {
  const { id, ...drawn } = Object.fromEntries(
    Object.entries(look).filter(([, value]) => value !== undefined),
  ) as ActionLook;
  return {
    action: {
      ...drawn,
      id: id ?? label,
      label,
      disabled: disabled || gesture.busy,
      onSelect: gesture.start,
    },
    dialog: gesture.dialog,
  };
}
