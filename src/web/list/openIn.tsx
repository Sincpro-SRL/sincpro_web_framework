"use client";

import type { OpenOptions, WorkspaceApi } from "@sincpro/web-composer";
import { Menu, type MenuOption, type OpenTarget, useUiCopy } from "@sincpro/web-ui";
import {
  AppWindow,
  Eye,
  FileText,
  type LucideIcon,
  PanelRight,
  SquareArrowOutUpRight,
  SquareStack,
} from "lucide-react";

/**
 * Where a record may open, and the menu that offers it.
 *
 * Context: a record opened from a list used to go one way — a press opened the page — and the
 * other places (a look, beside, a window) were the composer's `RecordLink` icons, shown only to
 * a pointer hovering the name of a TABLE row: nothing from the rows, the board, a one2many, and
 * never a modal. A record opens anywhere the workspace can put it unless the screen says
 * otherwise (`openTargets`), and «Abrir en…» says so where it is seen, in web-ui's own words
 * (`openIn`) — the same menu a many2one already has.
 *
 * The places allowed depend on where the list is: from inside a modal, no modal (a second one
 * would replace the first and lose what was typed in it) — composer says where a view is
 * (`api.over`).
 */

/** A record's form fits; a short task (register a payment) passes its own size. */
export const RECORD_SIZE = { w: 760, h: 560 } as const;

const EVERYWHERE: readonly OpenTarget[] = ["modal", "peek", "side", "page", "window"];
const FROM_A_MODAL: readonly OpenTarget[] = ["side", "peek", "page", "window"];

/** Where a record may open from this view, the default first. */
export function targetsFor(api: Pick<WorkspaceApi, "over">): readonly OpenTarget[] {
  return api.over === null ? EVERYWHERE : FROM_A_MODAL;
}

/** web-ui's target as composer's options. Destinations share their names, so only the size is
 *  added — to the two that have one. */
export function openOptions(
  to: OpenTarget,
  size: { w: number; h: number } = RECORD_SIZE,
): OpenOptions {
  return to === "modal" || to === "window" ? { to, size } : { to };
}

const ICON: Record<OpenTarget, LucideIcon> = {
  page: FileText,
  peek: Eye,
  modal: SquareStack,
  side: PanelRight,
  window: AppWindow,
};

/**
 * «Abrir en…»: a visible menu of the places a record may open, beside its name. Nothing when
 * there is one place or none — then a press is all there is.
 *
 *     <OpenInMenu targets={["modal", "side", "window"]} onOpen={(to) => openIn(api, ref, to)} />
 */
export function OpenInMenu({
  targets,
  onOpen,
  name,
}: {
  targets: readonly OpenTarget[];
  onOpen: (to: OpenTarget) => void;
  /** Whose menu it is, for a screen reader: «Abrir en… — F-2026-0004». */
  name?: string;
}) {
  const copy = useUiCopy().picker;
  if (targets.length === 0) return null;
  const options: MenuOption[] = targets.map((to) => ({
    id: to,
    label: copy.openIn[to],
    icon: ICON[to],
  }));
  return (
    <Menu
      label={name === undefined ? copy.openMore : `${copy.openMore} ${name}`}
      title={copy.openMore}
      groups={[{ options }]}
      onSelect={(id) => onOpen(id as OpenTarget)}
      icon={SquareArrowOutUpRight}
      iconOnly
      size="sm"
      role="ghost"
      align="end"
      width="sm"
    />
  );
}
