"use client";

import type { ComposerSkin, IconProps } from "@sincpro/web-composer";
import { Button, Dialog, Missing, Peek } from "@sincpro/web-ui";
import {
  AppWindow,
  ArrowLeft,
  Ellipsis,
  Eye,
  type LucideIcon,
  Maximize2,
  Minimize2,
  Minus,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Search,
  SquareArrowOutUpRight,
  X,
} from "lucide-react";

/**
 * The composer, dressed as web-ui.
 *
 * Context: since 1.0 the composer owns the BEHAVIOUR of the workspace and ships a minimal look
 * of its own so it works alone; the look is the application's, piece by piece (`skin`). This
 * package is married to web-ui, so its workspace should read as web-ui: lucide's icons, web-ui's
 * `Peek` drawer, its `Dialog` for «discard what you typed?», its `Missing` where a view could not
 * be drawn. `<SincproApp>` uses it by default; any piece can still be replaced on top of it.
 */
/**
 * A lucide icon at the composer's size. The composer draws an icon as `<Icon />`, sized by the
 * icon itself (its own glyphs are 16 px), and lucide's default is 24 px: unsized, every glyph
 * overflowed its 22 px control — a record link's peek/side/window grew larger than the name.
 */
function sized(Icon: LucideIcon) {
  function Sized({ className, strokeWidth = 2 }: IconProps) {
    return <Icon size={16} strokeWidth={strokeWidth} className={className} aria-hidden />;
  }
  Sized.displayName = Icon.displayName ?? "Icon";
  return Sized;
}

export const webUiSkin: ComposerSkin = {
  icons: {
    more: sized(Ellipsis),
    expand: sized(SquareArrowOutUpRight),
    minimize: sized(Minus),
    maximize: sized(Maximize2),
    restore: sized(Minimize2),
    close: sized(X),
    left: sized(PanelLeft),
    right: sized(PanelRight),
    bottom: sized(PanelBottom),
    window: sized(AppWindow),
    back: sized(ArrowLeft),
    search: sized(Search),
    peek: sized(Eye),
  },
  Peek: ({ title, onClose, actions, children }) => (
    <Peek open title={title} onClose={onClose} actions={actions}>
      {children}
    </Peek>
  ),
  Confirm: ({ open, title, detail, keep, discard, onAnswer }) => (
    <Dialog
      open={open}
      title={title}
      onClose={() => onAnswer(false)}
      footer={
        <div className="flex justify-end gap-2">
          <Button size="sm" role="secondary" onClick={() => onAnswer(true)}>
            {discard}
          </Button>
          <Button size="sm" role="primary" onClick={() => onAnswer(false)}>
            {keep}
          </Button>
        </div>
      }
    >
      <p className="text-ink">{detail}</p>
    </Dialog>
  ),
  Notice: ({ heading, detail, bad }) => (
    <Missing heading={heading} detail={detail} tone={bad ? "bad" : "warn"} />
  ),
};
