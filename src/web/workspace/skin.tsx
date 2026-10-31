"use client";

import type { ComposerSkin } from "@sincpro/web-composer";
import { Button, Dialog, Missing, Peek } from "@sincpro/web-ui";
import {
  AppWindow,
  ArrowLeft,
  Ellipsis,
  Eye,
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
export const webUiSkin: ComposerSkin = {
  icons: {
    more: Ellipsis,
    expand: SquareArrowOutUpRight,
    minimize: Minus,
    maximize: Maximize2,
    restore: Minimize2,
    close: X,
    left: PanelLeft,
    right: PanelRight,
    bottom: PanelBottom,
    window: AppWindow,
    back: ArrowLeft,
    search: Search,
    peek: Eye,
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
